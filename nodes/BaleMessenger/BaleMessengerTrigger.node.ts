import { INodeType, INodeTypeDescription, IWebhookResponseData } from 'n8n-workflow';
import { IHookFunctions, IWebhookFunctions } from 'n8n-core';
import { default as TelegramBot } from 'node-telegram-bot-api';

export class BaleMessengerTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'BaleMessenger Trigger',
		name: 'baleMessengerTrigger',
		icon: 'file:bale.svg',
		group: ['trigger'],
		version: 1,
		description: 'Starts the workflow on Bale update',
		defaults: {
			name: 'BaleMessenger Trigger',
		},
		inputs: [],
		outputs: ['main'],
		credentials: [
			{
				name: 'baleMessengerApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const credentials = await this.getCredentials('baleMessengerApi');
				const bot = new TelegramBot(credentials.token as string, {
					baseApiUrl: 'https://tapi.bale.ai',
				});
				const botWebhookUrl = (await bot.getWebHookInfo()).url;
				const nodeWebhookUrl = this.getNodeWebhookUrl('default');

				return nodeWebhookUrl === botWebhookUrl;
			},
			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const credentials = await this.getCredentials('baleMessengerApi');
				const bot = new TelegramBot(credentials.token as string, {
					baseApiUrl: 'https://tapi.bale.ai',
				});
				await bot.setWebHook(webhookUrl!);
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				const credentials = await this.getCredentials('baleMessengerApi');
				const bot = new TelegramBot(credentials.token as string, {
					baseApiUrl: 'https://tapi.bale.ai',
				});
				try {
					await bot.deleteWebHook();
				} catch (_) {
					return false;
				}
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const body = this.getBodyData();

		return {
			workflowData: [this.helpers.returnJsonArray(body)],
		};
	}

}
