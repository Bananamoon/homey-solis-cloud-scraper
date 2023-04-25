'use strict'

const Homey = require('homey')
const { addJob } = require('./handlers/cron')
const DataModel = require('./lib/DataModel.js');
const { setupConditions } = require('./handlers/setup-conditions')
const setupActions = require('./handlers/setup-actions')

class SolisScraper extends Homey.App {
	/**
	* onInit is called when the app is initialized
	*/
	async onInit () {
		this.isGettingData = false

		//TODO setup settingd

		//TODO setup triggers

		//TODO set up flow tokens

		//setup conditions
		// setupConditions({ app: this })

		// setup actions
		// setupActions(this)

		this.getSolisData(true)

		//TODO callback when settings have been set

		this._unload = () => {
			if(!this.jobs) return

			//unload cron jobs
			Object.getOwnPropertyNames(this.jobs).forEach(prop => {
				if(typeof this.jobs[prop].stop === 'function') {
					this.log('unload: Job ', prop, ' will be stopped')
					this.jobs[prop].stop()
				}
			})
		}

		this.homey.on('unload', () => {
	      if (typeof this._unload === 'function') {
	        this.log('unload')
	        this._unload()
	      } else this.warn('unload error')
	    })

	    this.startCronJobs()
	}

	startCronJobs () {
	    this.jobs = {
	      //Scrape soliscloud website every 6 mins
	      update: addJob('*/6 * * * *', () => {
	        if (this.isGettingData) return

	        this.log('startCronJobs:update: scraping data')
	        this.getSolisData()
	      }),
	    }
	}

	async getSolisData (regegisterSolisTokens = false) {
		this.isGettingData = true

		const timeElapsed = Date.now();
		const now = new Date(timeElapsed);
		console.log ("Scrape requested at " + now.toUTCString())

		try {
			const newData = await scrapeData()
			if (newData.size > 0){
				data = newData
				let scrapeMs = data.get('scrapeEndTimeMs');
				let scrapeTime = new Date(scrapeMs);
				console.log("Data scraped at " + scrapeTime.toUTCString())
				console.log(data);

				this.isGettingData = false
			} else {
				console.log("Unable to fetch data - using previous data")
			}
		} catch (err) {
			console.log("Error fetching data - using previous data")
		}
	}

	async function scrapeData() {

		const startTime = Date.now();

		const browser = await puppeteer.launch({
			headless:true,
			args: ['--no-zygote', '--no-sandbox']
		});

		try {
			const page = await browser.newPage();
			await page.setViewport({ width: 1200, height: 1000 });
			await page.goto(url);

			await waitForSelectorWithRetries(page, '.username input', "Login page", maxSelectorRetries, 1000 )

			// Fill in username and password
			await page.click(".username input")
			await page.type(".username input", username)
			await page.click(".username_pwd.el-input input")
			await page.type(".username_pwd.el-input input", password)

			// Click privacy policy
			await page.evaluate(() => {
				document.querySelector(".remember .el-checkbox__original").click()
			})

			// Click login button
			await page.click(".login-btn button")

			// Wait for page load then click on the table to go to station overview
			await page.waitForTimeout(5000)

			// Get station capacity - potential reload point
			await page.waitForSelector('.el-table__row .el-table_1_column_8 .cell')
			const stationElement = await page.$('.el-table__row .el-table_1_column_8 .cell')
			const stationCapacity = await (await stationElement.getProperty('textContent')).jsonValue()

			// await page.waitForSelector(".el-table__body-wrapper tr");
			await page.click(".el-table__body-wrapper tr")
		 	await page.waitForTimeout(5000)

			// Opens in new tab, so move that that
			let pages = await browser.pages();

			let popup = pages[pages.length - 1];
			await popup.setViewport({ width: 1200, height: 1000 });

			await waitForSelectorWithRetries(popup, '.toptext-info > div > .fadian-info > div > span:nth-child(2)', "Current stats diagram" , maxSelectorRetries )

			// Solar generation today
			const totalYieldElement = await popup.$('.toptext-info > div > .fadian-info > div > span:nth-child(2)')
			const totalYield = await (await totalYieldElement.getProperty('textContent')).jsonValue()

			// Solar generation now
			const currentGenElement = await popup.$('.animation > .wrap > .fadian > .content > span') 
			const currentGen = await (await currentGenElement.getProperty('textContent')).jsonValue()

			// Battery charge level now
			const batteryChargeElement = await popup.$('.chongdian > .content > div > .batteryProgress > .colorBox1')
			const batteryCharge = await (await batteryChargeElement.getProperty('textContent')).jsonValue()

			// Battery consumption now
			const drawFromBatteryElement = await popup.$('.animation > .wrap > .chongdian > .content > span')
			const drawFromBattery = await (await drawFromBatteryElement.getProperty('textContent')).jsonValue()

			// Battery charging today
			const todaysChargingElement = await popup.$('.bottomtext-info > div > .chongdian-info > div:nth-child(1) > span:nth-child(2)')
			const todaysCharging = await (await todaysChargingElement.getProperty('textContent')).jsonValue()

			// Battery discharge today
			const todaysDischargingElement = await popup.$('.bottomtext-info > div > .chongdian-info > div:nth-child(2) > span:nth-child(2)')
			const todaysDischarging = await (await todaysDischargingElement.getProperty('textContent')).jsonValue()

			// Today from grid
			const todayFromElement = await popup.$('.toptext-info > div > .maidian-info > div:nth-child(1) > span:nth-child(2)')
			const todayFromGrid = await (await todayFromElement.getProperty('textContent')).jsonValue()

			// Today to grid
			const todayToElement = await popup.$('.toptext-info > div > .maidian-info > div:nth-child(2) > span:nth-child(2)')
			const todayToGrid = await (await todayToElement.getProperty('textContent')).jsonValue()

			// Grid in/out now
			const currentGridInOutElement = await popup.$('.animation > .wrap > .maidian > .content > span')
			const currentGridInOut = await (await currentGridInOutElement.getProperty('textContent')).jsonValue()

			// House draw now
			const currentHouseDrawElement = await popup.$('.animation > .wrap > .yongdian > .content > span')
			const currentHouseDraw = await (await currentHouseDrawElement.getProperty('textContent')).jsonValue()

			// House consumption today
			const totalHouseConsumptionElement = await popup.$('.animation > .bottomtext-info > div > .yongdian-info > div > span:nth-child(2)')
			const totalHouseConsumption = await (await totalHouseConsumptionElement.getProperty('textContent')).jsonValue()

			await browser.close()

			const endTime = Date.now();
			const now = new Date(endTime);

			// Puppeteer will put the string value of NaN if it can't get it, which is why we check for the string not isNaN()
			if (currentGen === "NaN") {
				return new Map([])
			} else {
				const data = new Map([
					['totalYield',totalYield],
					['currentGen',currentGen],
					['batteryCharge',batteryCharge],
					['drawFromBattery',drawFromBattery],
					['todaysCharging',todaysCharging],
					['todaysDischarging',todaysDischarging],
					['todayFromGrid',todayFromGrid],
					['todayToGrid',todayToGrid],
					['currentGridInOut',currentGridInOut],
					['currentHouseDraw',currentHouseDraw],
					['totalHouseConsumption',totalHouseConsumption],
					['scrapeStartDurationMs', startTime],
					['scrapeEndTimeMs',endTime],
					['stationCapacity',stationCapacity],
					])

				return data
			}

		} catch (e) {
			console.log("Error - " + e.message)
			// await browser.close()
			throw (e);
		}
	}

	async function waitForSelectorWithRetries(page, selector, selectorDescription, maxRetries, timeoutms = 5000) {

		var retries = maxRetries

		while (retries > 0) {
			try {
				await page.waitForSelector(selector, {timeout: timeoutms })
				if (retries < maxRetries){
					console.log("  Retry successfull")
				}
				return
			}	catch (err) {
				await page.reload({ waitUntil: ["networkidle0", "domcontentloaded"] });
				retries -= 1
	    	console.log("Reloading selector ("+selectorDescription+").  " + retries + " retries remaining")
			}
		}
	}

	/**
   * onUninit method is called when your app is destroyed
   */
	async onUninit () {
	    if (typeof this._unload === 'function') {
	      this.log('onUninit')
	      this._unload()
	    } else this.warn('onUninit error')
	}
}

module.exports = SolisScraper