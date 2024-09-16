import puppeteer, {ElementHandle, Browser, Page, HTTPResponse} from 'puppeteer'
import { logger } from './logger'
import Colors from 'colors/safe'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {ethers, Wallet} from 'ethers'
import {inspect} from 'node:util'
import {request as requestHttps, RequestOptions} from 'node:https'
import Phin from 'phin'


const tweet = '1826732383296422252'

interface tweeted_status_result {
	core: {
		user_results: {
			result: twitterUser_content_itemContent_user_results_result
		}
	}
	edit_control: {
		edit_tweet_ids: string[]												//		['1834792666871013683']
		editable_until_msecs: string											//		1726287235238
		edits_remaining: number													//		5
		is_edit_eligible: boolean												//		false
	}
	is_translatable: boolean
	legacy: twitterTimev2_content_legacy
	quick_promote_eligibility: {
		eligibility: string
	}
	rest_id: string																//	1834792666871013683
	source: string																//	<a href=\"https://mobile.twitter.com\" rel=\"nofollow\">Twitter Web App</a>
	unmention_data: {}
	views: {
		state: 'Enabled'
	}
}
interface twitterTimev2_content_legacy {
	retweeted_status_result: {
		result: tweeted_status_result
	}
	bookmark_count: number																	//		0
	bookmarked: boolean
	rest_id: string																			//

}

interface twitterTimev2_content {
	clientEventInfo: {
		component: 'tweet'
		details: {
			timelinesDetails:{
				controllerData: {
					controllerData: string
					injectionType: string
				}
			}
		}
		element: 'tweet'
	}
	entryType: 'TimelineTimelineItem'
	itemContent: {
		itemType: 'TimelineTweet'
		tweetDisplayType: 'Tweet'
		tweet_results: {
			result: tweeted_status_result
		}
	}
}


interface twitterTimev2_contents {
	content: twitterTimev2_content															//		
	entryId: string																			//	tweet-1834792666871013683
	sortIndex: string																		//	1834792737430306815
}	

interface twitterUser_content_itemContent_user_results_result_legacy {
	can_dm: boolean															//		true																								true
	can_media_tag: boolean													//		true																								true				
	created_at: string														//		"Mon Oct 04 10:04:46 +0000 2021"																	Sat May 08 01:55:14 +0000 2021
	default_profile: boolean												//		true
	default_profile_image: boolean											//		false
	description: string														//		''
	entities: {
		description: {
			urls: string[]
		}
	}

	fast_followers_count: number											//		0																									0
	favourites_count: number												//		85																									1119
	followed_by: boolean													//		true																								true		true for followed me!!!!!!!!!!!
	followers_count: number													//		126																									507			************************************		126 Followers
	following: boolean														//		true																								true
	friends_count: number													//		274																									1636		************************************		275 Following
	has_custom_timelines: boolean											//		true
	is_translator: boolean													//		false																								false
	listed_count: number													//		0																									4
	location: string														//		""																									"Yau Tsim Mong District" 
	media_count: number														//		16																									59			***********************************
	name: string															//		"Rico Aissat"																						"DDD"		***********************************		USER NAME showing Big
	normal_followers_count: number											//		126																									507			************************************		126 Followers
	pinned_tweet_ids_str: string[]											//		['1826732383296422252']
	possibly_sensitive: boolean												//		false																								false
	profile_banner_url: string												//																											"https://pbs.twimg.com/profile_banners/1390847459824263169/1706808045"
	profile_image_url_https: string											//		"https://pbs.twimg.com/profile_images/1609831996708061184/dIXnZnC9_normal.jpg"						"https://pbs.twimg.com/profile_images/1753106073526177792/iTzCKF_1_normal.jpg"
	profile_interstitial_type: string										//		""
	screen_name: string														//		"RicoAissat"																						"walkerting1"
	statuses_count: number													//		112																									2234
	translator_type: string													//		"none"
	verified: boolean														//		false
	want_retweets: boolean													//		true
	withheld_in_countries: any[]											//		[]

}

interface twitterUser_content_clientEventInfo {
	component: string 														//	"FollowersSgs"
	element: string															//	"user"
}

interface twitterUser_content_itemContent_user_results_result {
	affiliates_highlighted_label: any										//	{}
	has_graduated_access: boolean											//	true
	id: string																//
	is_blue_verified: boolean												//	false																blue_verified
	legacy: twitterUser_content_itemContent_user_results_result_legacy
	profile_image_shape: string												//	"Circle"
	rest_id: string															//	1444966599656607751																					1390847459824263169
	tipjar_settings: {														//	{}
		is_enabled: boolean													//																										true
	}
}

interface twitterUser_content_itemContent_user_results {
	result: twitterUser_content_itemContent_user_results_result
}
interface twitterUser_content_itemContent {
	itemType: string												//	"TimelineUser"
	userDisplayType: string											//	"User"
	user_results: twitterUser_content_itemContent_user_results		
}
interface twitterUser_content {
	clientEventInfo: twitterUser_content_clientEventInfo
	entryType: string												//	"TimelineTimelineItem"
	itemContent: twitterUser_content_itemContent
}
interface twitterUser {
	content: twitterUser_content
	entryId: string
	sortIndex: string
}

interface account {
	account: string
	passwd: string
	postAccount: string
}

interface taskPoolObj {
	checkAccount: string
	uuid: string
	result: {
		status: number,
		isFollow: boolean
		isRetweet: boolean
	}
	walletAddress: string
}

let browser:  Browser
let page: Page|null = null
let pageLocked = false
let wallet: Wallet
const postPool: taskPoolObj[] = []


const startGossip = (url: string, POST: string, callback: (err?: string, data?: string) => void) => {
	const Url = new URL(url)

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
			kkk.destroy()
			logger(Colors.red(`startGossip [${url}] res on ERROR! Try to restart! `), err.message)
			return startGossip (url, POST, callback)
		})

		res.once('end', () => {
			kkk.destroy()
			logger(Colors.red(`startGossip [${url}] res on END! Try to restart! `))
			return startGossip (url, POST, callback)
		})
		
	})

	// kkk.on('error', err => {
	// 	kkk.destroy()
	// 	logger(Colors.red(`startGossip [${url}] requestHttps on Error! Try to restart! `), err.message)
	// 	return startGossip (url, POST, callback)
	// })

	kkk.end(POST)

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
			data = data.replace('\r\n', '')
			try {
				const kk = JSON.parse(data)
				const taskPoolObj: taskPoolObj = {
					checkAccount: kk.data[0],
					uuid: kk.uuid,
					result: {
						isFollow: false,
						isRetweet: false,
						status: 200
					},
					walletAddress: kk.walletAddress
				}
				postPool.push(taskPoolObj)
				
			} catch (ex) {
				return logger(Colors.magenta(`startGossip got format error data from API`))
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

const searchAccount = async () => {
	if (!page|| pageLocked) {
		return
	}

	const task = postPool.shift()
	if (!task) {
		return logger(Colors.gray(`postPool has empty!`))
	}
	pageLocked = true

	const _Timeout = setTimeout(async () => {

		logger(Colors.red(`_Timeout Error! response Error!`))
		task.result.status = 500
		await callbackTwitter(task)
		pageLocked = false
		return searchAccount()

	}, 1000*60 * 3)

	const listen = async (response: HTTPResponse) => {
		const url = response.url()
		const test = /\/UserTweets\?/.test (url)
		const test1 = /\/UserByScreenName\?/.test(url)

		if (test) {
			
			const ret = await response.json()
			
			if (ret?.data?.user?.result?.timeline_v2?.timeline?.instructions?.length) {

				logger(Colors.grey(`loading ${response.url()}`))
				clearTimeout(_Timeout)
				const _results = ret.data.user.result.timeline_v2.timeline.instructions[2]||ret.data.user.result.timeline_v2.timeline.instructions[1]
				if (_results?.entries?.length>0) {
					
					const results: twitterTimev2_contents[] = _results.entries
					
					if (results[0]?.content?.itemContent?.tweet_results?.result?.core?.user_results?.result?.legacy) {
						const legacy: twitterUser_content_itemContent_user_results_result_legacy = results[0].content.itemContent.tweet_results.result.core.user_results.result.legacy
						if (legacy?.followed_by === true) {
							task.result.isFollow = true
						}
						
					}
					


					const inedx = results.findIndex(n => n.content.itemContent?.tweet_results?.result?.legacy?.retweeted_status_result?.result.rest_id === tweet)
					if (inedx > -1) {
						task.result.isRetweet = true
					}
				}

				
			}
			if (page) {
				page.removeAllListeners('response')
			}
			
			
			await callbackTwitter(task)

			pageLocked = false
			return searchAccount()
		}
		
		if (test1) {
			const ret = await response.json()
			if (!ret?.data) {
				if (page) {
					page.removeAllListeners('response')
				}
				task.result.status=404
				await callbackTwitter(task)

				pageLocked = false
				return searchAccount()
			}
			
			
		}
		
	}



	page.on ('response', listen)

	logger(Colors.blue(`searchAccount checkAccount ${task.checkAccount}`))
	return await page.goto(`https://x.com/${task.checkAccount}`)
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
			logger(Colors.grey(`loading ${response.url()}`))
			const ret = await response.json()
			if (ret?.data?.user?.result?.legacy) {
				if (page) {
					page.removeAllListeners('response')
				}
				const data: twitterUser_content_itemContent_user_results_result_legacy = ret.data.user.result.legacy

				if (data.pinned_tweet_ids_str?.length) {
					pinnedHrl = `https://x.com/${username}/status/${data.pinned_tweet_ids_str[0]}`
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