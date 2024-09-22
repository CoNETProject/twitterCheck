import Phin from 'phin'
import { logger } from './logger'
import {ethers} from 'ethers'
import Colors from 'colors/safe'
import {inspect} from 'node:util'


const testTwitterAPI = async () => {
	const acc = ethers.Wallet.createRandom()
	const url = 'https://apiv3.conet.network/api/twitter-check-follow'
	const checkTwitterAccount = 'teeffvvgg'
	const messageObj: minerObj = {
		walletAddress: acc.address.toLowerCase(),
		data: [checkTwitterAccount]
	}
	const message = JSON.stringify(messageObj)
	const signMessage = await acc.signMessage(message)
	const data = {message, signMessage}
	const req = await Phin({
		url,
		method: 'POST',
		data
	})
	try {
		const result = JSON.parse(req.body.toString())
		logger(inspect(result, false, 3, true))
	} catch (ex) {
		logger(Colors.red(`testTwitterAPI JSON parse ERROR`))
		return logger(req.body.toString())
	}
}

testTwitterAPI()