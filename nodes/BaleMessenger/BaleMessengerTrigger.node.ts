import {
	IDataObject,
	INodeType,
	INodeTypeDescription,
	IWebhookResponseData,
	JsonObject,
	NodeApiError
} from 'n8n-workflow';
import {IHookFunctions, IWebhookFunctions} from 'n8n-core';
import {default as TelegramBot} from 'node-telegram-bot-api';
import axios from 'axios';

const BALE_API_URL = `https://tapi.bale.ai`;

interface EventBody {
	photo?: [
		{
			file_id: string;
		},
	];
	document?: {
		file_id: string;
	};
	video?: {
		file_id: string;
	};
}

interface IEvent {
	message?: EventBody;
	channel_post?: EventBody;
	download_link?: string;
}

function getImageBySize(photos: IDataObject[], size: string): IDataObject | undefined {
	const sizes = {
		small: 0,
		medium: 1,
		large: 2,
		extraLarge: 3,
	} as IDataObject;

	const index = sizes[size] as number;

	return photos[index];
}

// import type { IEvent } from './IEvent';
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
		properties: [],
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
		const body = this.getBodyData() as IEvent;
		const credentials = await this.getCredentials('baleMessengerApi');
		const token = credentials.token as string

		let imageSize = 'large';

		let key: 'message' | 'channel_post' = 'message';

		if (body.channel_post) {
			key = 'channel_post';
		}

		if (
			(body[key]?.photo && Array.isArray(body[key]?.photo)) ||
			body[key]?.document ||
			body[key]?.video
		) {

			let fileId;

			if (body[key]?.photo) {
				let image = getImageBySize(
					body[key]?.photo as IDataObject[],
					imageSize,
				) as IDataObject;

				// When the image is sent from the desktop app telegram does not resize the image
				// So return the only image available
				// Basically the Image Size parameter would work just when the images comes from the mobile app
				if (image === undefined) {
					image = body[key]!.photo![0];
				}

				fileId = image.file_id;
			} else if (body[key]?.video) {
				fileId = body[key]?.video?.file_id;
			} else {
				fileId = body[key]?.document?.file_id;
			}

			try {
				const axiosInstance = axios.create({
						maxContentLength: 2 * 1024 * 1024 * 1024, // 2GB
						headers: {
								'Content-Type': 'application/json',
						},
				});
				// First Axios request to get file_path
				const fileResponse = await axiosInstance.get(
					`${BALE_API_URL}/bot${token}/getFile?file_id=${fileId}`
				);
				const file_path = fileResponse.data.result.file_path;
				// Second Axios request to get the file
				const file = await axiosInstance.get(
					`${BALE_API_URL}/file/bot${token}/${file_path}`,
					{
						responseType: 'arraybuffer',
					}
				);

				const data = Buffer.from(file.data);

				const fileName = file_path.split('/').pop();

				const binaryData = await this.helpers.prepareBinaryData(
					data as unknown as Buffer,
					fileName as string,
				);

				return {
					workflowData: [
						[
							{
								json: body as unknown as IDataObject,
								binary: {
									data: binaryData,
								},
							},
						],
					],
				};
			} catch (error) {
				throw new NodeApiError(this.getNode(), error as JsonObject);
			}
		}
		return {
			workflowData: [this.helpers.returnJsonArray([body as unknown as IDataObject])],
		};
	}
}
