import { ICredentialType, INodeProperties, } from 'n8n-workflow';

export class BaleMessengerApi implements ICredentialType {
	name = 'baleMessengerApi';
	displayName = 'BaleMessenger API';
	documentationUrl = '<your-docs-url>';
	properties: INodeProperties[] = [
		{
			displayName: 'API Token',
			name: 'token',
			type: 'string',
			default: '',
			typeOptions: {
				password: true
			},
			placeholder: 'BotFather token',
			description: 'You can get a token for your bot from @botfather'
		},
	];

}
