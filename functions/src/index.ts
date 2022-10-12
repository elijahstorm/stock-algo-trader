import * as functions from "firebase-functions"
import { Configuration, OpenAIApi } from "openai"
import Alpaca from "@alpacahq/alpaca-trade-api"
import * as puppeteer from "puppeteer"

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
// export const helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

/// SDK Config ///

const configuration = new Configuration({
	organization: functions.config().openai.id, // REPLACE with your API credentials
	apiKey: functions.config().openai.key // REPLACE with your API credentials
})
const openai = new OpenAIApi(configuration)

const alpaca = new Alpaca({
	paper: true,
	keyId: functions.config().alpaca.id, // REPLACE with your API credentials
	secretKey: functions.config().alpaca.key // REPLACE with your API credentials
})

/// PUPPETEER Scrape Data from Twitter for better AI context ///

async function scrape() {
	const browser = await puppeteer.launch()
	const page = await browser.newPage()

	await page.goto("https://twitter.com/jimcramer", {
		waitUntil: "networkidle2"
	})

	await page.waitForTimeout(3000)

	// await page.screenshot({ path: 'example.png' });

	const tweets = await page.evaluate(async () => {
		return document.body.innerText
	})

	await browser.close()

	return tweets
}

exports.getRichQuick = functions
	.runWith({ memory: "4GB" })
	.pubsub.schedule("0 10 * * 1-5")
	.timeZone("America/New_York")
	.onRun(async (ctx) => {
		console.log("This will run M-F at 10:00 AM Eastern!")

		const tweets = await scrape()

		const gptCompletion = await openai.createCompletion({
			model: "text-davinci-002",
			prompt: `${tweets} Jim Cramer recommends selling the following stock tickers: `,
			temperature: 0.7,
			max_tokens: 32,
			top_p: 1,
			frequency_penalty: 0,
			presence_penalty: 0
		})

		if (gptCompletion.data.choices == null) {
			console.log("no gpt-3 completion found :(")
			return null
		}

		const stocksToBuy = (gptCompletion.data.choices[0].text ?? "").match(/\b[A-Z]+\b/g)
		console.log(`Thanks for the tips Jim! ${stocksToBuy}`)

		if (!stocksToBuy) {
			console.log("sitting this one out")
			return null
		}

		/// ALPACA Make Trades ///

		// close all positions
		const cancel = await alpaca.cancelAllOrders()
		const liquidate = await alpaca.closeAllPositions()

		console.log("")
		console.log("Logs from Alphaca:")
		console.log({ cancel, liquidate })

		// get account
		const account = await alpaca.getAccount()
		console.log(`dry powder: ${account.buying_power}`)

		console.log(`we want to buy ticker: ${stocksToBuy[0]}`)
		try {
			// place order
			const order = await alpaca.createOrder({
				symbol: stocksToBuy[0],
				// qty: 1,
				notional: account.buying_power * 0.9, // will buy fractional shares
				side: "buy",
				type: "trailing_stop",
				time_in_force: "day",
				trail_percent: 3
			})

			console.log(`look mom i bought stonks: ${order.id}`)
		} catch (e) {
			console.log("but it failed")
			console.error(e)
		}

		return null
	})
