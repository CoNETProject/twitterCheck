import puppeteer, {ElementHandle, Browser, Page, HTTPResponse} from 'puppeteer'
import { logger } from './logger'
import Colors from 'colors/safe'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {ethers, Wallet} from 'ethers'
import {inspect} from 'node:util'
import type {IncomingMessage} from 'node:http'
import {request as requestHttps, RequestOptions} from 'node:https'
import Phin from 'phin'


let browser:  Browser
let page: Page|null = null
let pageLocked = false
let wallet: Wallet
const postPool: taskPoolObj[] = []


const startGossip = (url: string, POST: string, callback: (err?: string, data?: string) => void) => {
	const Url = new URL(url)
	let res: IncomingMessage|null = null
	const option: RequestOptions = {
		hostname: Url.hostname,
		port: 443,
		method: 'POST',
		protocol: 'https:',
		headers: {
			'Content-Type': 'application/json;charset=UTF-8'
		},
		path: Url.pathname
	}

	let first = true
	logger(inspect(option, false, 3, true))
	const kkk = requestHttps(option, res => {

		if (res.statusCode !==200) {
			res.destroy()
			return setTimeout(() => {
				startGossip(url, POST,callback )
				return logger(`startTestMiner got res.statusCode = [${res.statusCode}] != 200 error! restart`)
			}, 1000)
			
		}

		let data = ''
		let _Time: NodeJS.Timeout

		res.on ('data', _data => {

			data += _data.toString()
			
			if (/\r\n\r\n/.test(data)) {
				clearTimeout(_Time)
				if (first) {
					first = false
				}
				
				callback ('', data)
				data = ''
				
			}
		})

		res.once('error', err => {
			
			logger(Colors.red(`startGossip [${url}] res on ERROR! Try to restart! `), err.message)
			startGossip(url, POST,callback )
		})

		res.once('end', () => {
			res.destroy()
			logger(Colors.red(`res on end! destroy res!`))

		})
		
	})

	// kkk.on('error', err => {
	// 	kkk.destroy()
	// 	logger(Colors.red(`startGossip [${url}] requestHttps on Error! Try to restart! `), err.message)
	// 	return startGossip (url, POST, callback)
	// })

	kkk.end(POST)

	kkk.once ('error', err => {
		logger(`startGossip requestHttps on Error! restart again! ${err.message}`)
		return startGossip (url, POST, callback)
	})
}

const listenAPIServer = async () => {
	const apiServer = 'https://apiv3.conet.network/api/twitter-listen'
	const message = JSON.stringify({walletAddress: wallet.address.toLowerCase()})
	const signMessage = await wallet.signMessage(message)
	const post = JSON.stringify({message, signMessage})
	let first = true
	startGossip(apiServer, post, (err, data) => {
		if (first) {
			first = false
			if (err) {
				
				return logger(Colors.magenta(`listenAPIServer startGossip return Error! ${err} restart!`))
			}
			return logger(Colors.blue(`listenAPIServer startGossip connecting API success!`))
		}
		logger(Colors.blue(`listenAPIServer got message from API`), data)
		if (data) {
			data = data.replaceAll(/\r\n/g, '')
			try {
				const kk = JSON.parse(data)
				const taskPoolObj: taskPoolObj = {
					checkAccount: kk.data[0],
					uuid: kk.uuid,
					result: {
						isFollow: false,
						isRetweet: false,
						status: 200,
						account:  kk.data[0]
					},
					walletAddress: kk.walletAddress
				}
				postPool.push(taskPoolObj)
				
			} catch (ex) {
				logger(inspect(data, false, 3, true))
				return logger(Colors.magenta(`startGossip got JSON error data from API `))
			}

			return searchAccount()
		}
		
	})
}


const callbackTwitter = async (obj: taskPoolObj) => {

	logger(Colors.blue(`callbackTwitter to API`))
	logger(inspect(obj, false, 3, true))
	const url = 'https://apiv3.conet.network/api/twitter-callback'
	const message = JSON.stringify({walletAddress: wallet.address.toLowerCase(), data:obj })
	const signMessage = await wallet.signMessage(message)
	const data = {message, signMessage}
	const req = await Phin({
		url,
		method: 'POST',
		data
	})

	logger(req.body.toJSON())
}


const _searchAccount: (checkAccount: string) => Promise<twitter_result> = (checkAccount: string) => new Promise(async resolve => {
	checkAccount = checkAccount.replace(/^\@/,'')
	let result: twitter_result = {
		isFollow: false,
		isRetweet: false,
		status: 501,
		account: checkAccount
	}

	if (!page) {
		return resolve(result)
	}

	const _Timeout = setTimeout(async () => {
		logger(Colors.red(`_Timeout Error! response Error!`))
		return resolve(result)
	}, 1000 * 5)

	result.status = 200
	const listen = async (response: HTTPResponse) => {
		const url = response.url()
		const test = /\/UserTweets\?/.test (url)
		const test1 = /\/UserByScreenName\?/.test(url)

		if (test) {
			
			const ret = await response.json()
			clearTimeout(_Timeout)
			if (ret?.data?.user?.result?.timeline_v2?.timeline?.instructions) {

				logger(Colors.grey(`loading ${response.url()}`))
				clearTimeout(_Timeout)
				const _results = ret.data.user.result.timeline_v2.timeline.instructions[2]||ret.data.user.result.timeline_v2.timeline.instructions[1]
				if (_results?.entries?.length>0) {
					
					const results: twitterTimev2_contents[] = _results.entries
					
					if (results[0]?.content?.itemContent?.tweet_results?.result?.core?.user_results?.result?.legacy) {
						const legacy: twitterUser_content_itemContent_user_results_result_legacy = results[0].content.itemContent.tweet_results.result.core.user_results.result.legacy
						if (legacy?.followed_by === true) {
							result.isFollow = true
						}
						
					}

					const inedx = results.findIndex(n => n.content.itemContent?.tweet_results?.result?.legacy?.retweeted_status_result?.result.rest_id === pinnedHrl)
					if (inedx > -1) {
						result.isRetweet = true
					}
				}
				
			}
			if (page) {
				page.removeAllListeners('response')
			}
			
			return resolve(result)
		
		}

		if (test1) {
			logger(Colors.grey(`loading UserByScreenName!`))
			
			const ret = await response.json()
			const userdata: twitterUser_content_itemContent_user_results_result = ret?.data?.user?.result
			
			if (userdata) {
				
				if (userdata?.legacy?.protected) {
					result = {
						protected: true,
						status: 200,
						message: `User profile may not be readable because it was protected!`,
						account: checkAccount
					}
					
				}
				
				result.isFollow = userdata?.legacy?.followed_by
				
				
			} else {
				result = {
					status: 404,
					message: 'User has not exist!',
					account: checkAccount
				}
			}
			
		}
		
	}

	page.on ('response', listen)

	logger(Colors.blue(`searchAccount checkAccount ${checkAccount}`))
	return await page.goto(`https://x.com/${checkAccount}`)
})


const searchAccount = async () => {

	const task = postPool.shift()
	if (!task) {
		return logger(Colors.gray(`postPool has empty!`))
	}
	pageLocked = true
	task.result = await _searchAccount (task.checkAccount)
	await callbackTwitter (task)
	pageLocked = false
	searchAccount()
}

let pinnedHrl = ''

const startTwitter = async (username: string, passwd: string) => new Promise(async resolve => {
	browser = await puppeteer.launch({devtools: true, headless: false})
	page = await browser.newPage()
	await page.setViewport({width: 1080, height: 1400})


	page.on('response', async response => {
		const url = response.url()
		const test = /\/UserByScreenName\?/.test(url)
		if (test) {
			logger(Colors.grey(`loading main user ${username} UserByScreenName`))
			const ret = await response.json()
			if (ret?.data?.user?.result?.legacy) {
				if (page) {
					page.removeAllListeners('response')
				}
				const data: twitterUser_content_itemContent_user_results_result_legacy = ret.data.user.result.legacy

				if (data.pinned_tweet_ids_str?.length) {
					pinnedHrl = data.pinned_tweet_ids_str[0]
				}
			}
		}
	})


	page.waitForSelector(`input[autocapitalize='sentences']`).then (async element => {

		if (!element||!page) {
			return resolve (null)
		}
		//			wait Password input
		page.waitForSelector(`input[type='password']`).then (async element => {
			if (!element) {
				return logger(Colors.red(`Can't find INPUT from password!`))
			}
			await element.click()
			await element.type(passwd, {delay: 200})
			await element.press('Enter')
		}).then (async ()=> {
			if (!page) {
				return resolve (null)
			}
			const profile = `/${username}`
			logger(Colors.magenta(`Logion success! Wait for listen!`))
			return await page.waitForSelector(`a[href='${profile}']`)
		}).then(async ele => {
			if (!ele) {
				return logger(`have not profile link`)
			}
			logger(Colors.magenta(`Click profile`))
			return await ele.click()
		}).then(async () => {
			if (!page) {
				return resolve (null)
			}
			const follorLink = `/${username}/verified_followers`
			logger(Colors.magenta(`Goto Profile`))
			return await page.waitForSelector(`a[href='${follorLink}']`)
		}).then (async ele => {
			if (!ele) {
				return logger(`have not verified_followers link`)
			}
			logger(Colors.magenta(`Click verified_followers link`))
			return await ele.click()
		}).then (async () => {
			if (!page) {
				return resolve (null)
			}
			const follorLink = `/${username}/followers`
			logger(Colors.magenta(`goto ${follorLink} `))
			return await page.waitForSelector(`a[href='${follorLink}']`)
		}).then (async ele => {
			if (!ele) {
				return logger(`have not followers link`)
			}
			return await ele.click()
		}).then (async () => {
			return resolve(true)
		}).catch (async ex => {
			logger(Colors.red(`has not input username Error`))
			return resolve (null)
			// page.waitForSelector(`input[data-testid='ocfEnterTextTextInput']`).then (async element => {
			// 	if (!element) {
			// 		return logger(Colors.red(`Can't find INPUT from phone!`))
			// 	}
			// 	logger(Colors.blue(`Twitter move to PHONE input`))
			// 	await element.click()
			// 	await element.type('', {delay: 200})
			// 	await element.press('Enter')
			// })
		})


		logger(`USER Name input!`)
		await element.click()
		await element.type(username, {delay: 200})
		await element.press('Enter')
	}).catch(async ex => {
		logger(Colors.red(`startTwitter has ex Error Try start again !`), ex)
		if (browser) {
			await browser.close()
		}
		return resolve (false)
		
	})

	return await page.goto('https://x.com/i/flow/login')
})

const start = async () => {
	const filePath = join(__dirname,'.twitter.json')
	logger(Colors.magenta(`filePath ${filePath}`))
	const kk = readFileSync(filePath,'utf-8')
	const account: account = JSON.parse(kk)
	await startTwitter(account.account, account.passwd)
	wallet = new ethers.Wallet(account.postAccount)
	listenAPIServer()
}

start()