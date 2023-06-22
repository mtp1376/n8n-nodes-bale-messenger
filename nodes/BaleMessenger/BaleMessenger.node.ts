import { INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { BINARY_ENCODING, IExecuteFunctions } from "n8n-core";
import { default as TelegramBot } from 'node-telegram-bot-api';

export class BaleMessenger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'BaleMessenger',
		name: 'baleMessenger',
		icon: 'file:bale.svg',
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with Bale Messenger API',
		defaults: {
			name: 'BaleMessenger',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'baleMessengerApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Message',
						value: 'message',
					},
				],
				default: 'message',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['message'],
					},
				},
				options: [
					{
						name: 'Send Document',
						value: 'sendDocument',
						description: 'Send a document',
						action: 'Send a document',
					},
					{
						name: 'Send Message',
						value: 'sendMessage',
						description: 'Send a text message',
						action: 'Send a text message',
					},
					{
						name: 'Send Photo',
						value: 'sendPhoto',
						description: 'Send a photo',
						action: 'Send a photo message',
					},
				],
				default: 'sendMessage',
			},

			{
				displayName: 'Chat ID',
				name: 'chatId',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: [
							'sendDocument',
							'sendMessage',
							'sendPhoto',
						],
						resource: ['chat', 'message'],
					},
				},
				required: true,
				description:
					'Unique identifier for the target chat',
			},

			{
				displayName: 'Binary Property',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				displayOptions: {
					show: {
						operation: [
							'sendDocument',
							'sendPhoto',
						],
						resource: ['message'],
					},
				},
				placeholder: '',
				description: 'Name of the binary property that contains the data to upload',
			},


			{
				displayName: 'Text',
				name: 'text',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						operation: ['editMessageText', 'sendMessage'],
						resource: ['message'],
					},
				},
				description: 'Text of the message to be sent',
			},

		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const operation = this.getNodeParameter('operation', 0);
		const credentials = await this.getCredentials('baleMessengerApi');
		// credentials.token

		const bot = new TelegramBot(credentials.token as string, { baseApiUrl: 'https://tapi.bale.ai' });

		for (let i = 0; i < items.length; i++) {
			const chatId = this.getNodeParameter('chatId', i) as string;

			if (operation === 'sendMessage') {
				const text = this.getNodeParameter('text', i) as string;
				const res = await bot.sendMessage(chatId, text);
				returnData.push({
					json: {
						...res
					},
					binary: {},
					pairedItem: { item: i },
				});
			}

			if (operation === 'sendDocument') {
				const binaryPropertyName = this.getNodeParameter('binaryPropertyName', 0) as string;
				const itemBinaryData = items[i].binary![binaryPropertyName];
				const uploadData = Buffer.from(itemBinaryData.data, BINARY_ENCODING);

				await bot.sendDocument(chatId, uploadData, {}, { filename: itemBinaryData.fileName })
			}

			if (operation === 'sendPhoto') {
				const binaryPropertyName = this.getNodeParameter('binaryPropertyName', 0) as string;
				const itemBinaryData = items[i].binary![binaryPropertyName];
				const uploadData = Buffer.from(itemBinaryData.data, BINARY_ENCODING);

				await bot.sendPhoto(chatId, uploadData, {})
			}
		}

		return this.prepareOutputData(returnData);
	}
}
