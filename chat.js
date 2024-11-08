// ⠀⠀⠀⠀⠀⢠⣴⣶⣶⣶⣶⣶⣦⣤⣤⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀\n     ⠀⠀⠀⠀⢀⣴⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣶⣄⠀⠀⠀⠀⠀⠀⠀⠀\n     ⠀⠀⠀⣰⣿⣿⣿⣿⣿⣿⣿⡿⠿⠛⠛⠛⠛⠿⣿⣿⣿⣦⠀⠀⠀⠀⠀⠀\n     ⠀⢀⣾⣿⣿⣿⣿⠟⠋⠁⠀⠀⠀⠀⠀⠀⠀⠀⠈⠙⢿⣿⣷⡄⠀⠀⠀⠀\n     ⢠⣿⣿⣿⠟⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⢻⣿⣿⡄⠀⠀⠀\n     ⣿⣿⣿⠃⠀⠀⠀⠀⠀⠀⣀⣀⣀⣀⠀⠀⠀⠀⠀⠀⠀⠘⣿⣿⣿⡄⠀⠀\n     ⣿⣿⠇⠀⠀⠀⢀⣴⣾⣿⣿⣿⣿⣿⣿⣿⣶⣄⠀⠀⠀⠀⢹⣿⣿⣷⠀⠀\n     ⣿⣿⠀⠀⢀⣴⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⡄⠀⠀⢸⣿⣿⣿⡆⠀\n     ⣿⣿⠀⣴⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣦⠀⢸⣿⣿⣿⡇⠀\n     ⢹⣿⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣾⣿⣿⣿⠀⠀\n     ⠈⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠏⠀⠀\n     ⠀⠘⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠃⠀⠀⠀\n  \

// v1.2

// https://docs.anthropic.com/en/docs/

const readline = require('readline');
const fs = require('fs/promises');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const inquirer = require('inquirer');

const Spinner = require('cli-spinner').Spinner;

const spinner = new Spinner({
    text: '%s ',
    stream: process.stderr,
    onTick: function(msg){
        this.clearLine(this.stream);
        this.stream.write(msg);
    }
});
spinner.setSpinnerString(7);

const CONFIG_FILE = path.join(__dirname, 'chat_config.json');
const HISTORY_FILE = path.join(__dirname, 'chat_history.json');
const SYSTEM_PROMPTS_FILE = path.join(__dirname, 'system_prompts.json');
const TOKENS_LOG_FILE = path.join(__dirname, 'tokens_log.json');
const MAX_TOKENS = 1024*3;
const MAX_WIDTH = 100;
let TOTAL_INPUT_TOKENS = 0;
let TOTAL_OUTPUT_TOKENS = 0;

const MODELS = [
    { 
        name: 'Claude 3 Opus ($15/M + $75/M)', 
        value: 'claude-3-opus-latest',
        priceInput: 15/1000000,
        priceOutput: 75/1000000
    },
    { 
        name: 'Claude 3.5 Sonnet ($3/M + $15/M)', 
        value: 'claude-3-5-sonnet-latest',
        priceInput: 3/1000000,
        priceOutput: 15/1000000
    },
    { 
        name: 'Claude 3.5 Haiku ($1/M + $5/M)', 
        value: 'claude-3-5-haiku-latest',
        priceInput: 3/1000000,
        priceOutput: 15/1000000
    }
];

class ChatApp {
    constructor() {
        this.config = {};
        this.messages = [];
        this.anthropic = null;
        this.rl = null;
    }

    async init() {
        try {
            await this.loadOrCreateConfig();
            await this.setupAnthropicClient();
            await this.loadHistory();
            this.setupReadline();
            console.log(`\nWelcome, ${this.config.userName}!`);
            console.log("Type '/help' to see available commands.\n");
            // await this.startChat();
            await this.renderMessages();
            await this.promptUser();
        } catch (error) {
            console.error('Error initializing chat:', error);
            process.exit(1);
        }
    }

    async loadOrCreateConfig() {
        try {
            const data = await fs.readFile(CONFIG_FILE, 'utf8');
            this.config = JSON.parse(data);
        } catch (error) {
            console.log('\n🔧 No configuration file found. Creating a new one...\n');
            await this.configureApp();
        }
    }
    
    async saveSystemPrompt(model, prompt) {
        try {
            let systemPrompts;
            try {
                systemPrompts = await fs.readFile(SYSTEM_PROMPTS_FILE, 'utf8');
                systemPrompts = JSON.parse(systemPrompts);
            } catch (error) {
                systemPrompts = [];
            }
            systemPrompts.push({
                model: model,
                prompt: prompt,
                date: new Date().toISOString().split('T')[0].split('-').slice(0, 3).join('-')
            });
            await fs.writeFile(SYSTEM_PROMPTS_FILE, JSON.stringify(systemPrompts, null, 2));
        } catch (error) {
            console.error('Error saving system prompt:', error);
        }
    }
    
    async countTokens(systemPrompt, messages) {
        try {
            const response = await this.anthropic.beta.messages.countTokens({
                betas: ["token-counting-2024-11-01"],
                model: this.config.model,
                system: systemPrompt,
                messages: messages,
            });
            return response;
        } catch (error) {
            console.error('Error counting tokens:', error);
            return { input_tokens: 0, output_tokens: 0 };
        }
    }
    
    async reConfigure() {
        try {
            const configChoice = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'option',
                    message: 'What would you like to configure?',
                    choices: [
                        { name: 'Name', value: 'userName' },
                        { name: 'API Key', value: 'apiKey' },
                        { name: 'Max history', value: 'maxHistory' },
                        { name: 'Model', value: 'model' },
                        { name: 'System Prompt', value: 'systemPrompt' },
                        { name: 'Temperature', value: 'temperature' },
                        { name: 'Cancel', value: 'cancel' }
                    ]
                }
            ]);

            if (configChoice.option === 'cancel') {
                await this.promptUser();
                return;
            }

            let answer;
            switch (configChoice.option) {
                case 'userName':
                    answer = await inquirer.prompt([{
                        type: 'input',
                        name: 'userName',
                        message: 'What should Claude call you?',
                        validate: input => input.length >= 1,
                        default: this.config.userName
                    }]);
                    this.config.userName = answer.userName;
                    break;
                    
                case 'apiKey':
                    answer = await inquirer.prompt([{
                        type: 'password',
                        name: 'apiKey',
                        message: 'Enter your Anthropic API key:',
                        validate: input => input.length >= 1
                    }]);
                    this.config.apiKey = answer.apiKey;
                    await this.setupAnthropicClient();
                    break;

                case 'maxHistory':
                    answer = await inquirer.prompt([{
                        type: 'number',
                        name: 'maxHistory',
                        message: 'Maximum number of messages to keep in history (recommended: 10-20):',
                        default: this.config.maxHistory,
                        validate: input => input >= 1 && input <= 1000
                    }]);
                    this.config.maxHistory = answer.maxHistory;
                    break;

                case 'model':
                    answer = await inquirer.prompt([{
                        type: 'list',
                        name: 'model',
                        message: 'Select Claude model to use:',
                        choices: MODELS
                    }]);
                    this.config.model = answer.model;
                    await this.setupAnthropicClient();
                    break;

                case 'systemPrompt':
                    answer = await inquirer.prompt([{
                        type: 'input',
                        name: 'systemPrompt',
                        message: 'Enter a system prompt for Claude:',
                        default: this.config.systemPrompt
                    }]);
                    this.config.systemPrompt = answer.systemPrompt;
                    await this.saveSystemPrompt(this.config.model, this.config.systemPrompt);
                    break;

                case 'temperature':
                    answer = await inquirer.prompt([{
                        type: 'number',
                        name: 'temperature',
                        message: 'Temperature (0-1): [Default: 1. Creative. 0: Conservative.]',
                        default: this.config.temperature,
                        validate: input => input >= 0 && input <= 1
                    }]);
                    this.config.temperature = answer.temperature;
                    break;
            }

            await fs.writeFile(CONFIG_FILE, JSON.stringify(this.config, null, 2));
            console.log('\n✅ Configuration updated successfully!\n');
            
            // Add a small delay to ensure proper terminal state
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Return to the prompt
            await this.promptUser();
        } catch (error) {
            console.error('Error during configuration:', error);
            await this.promptUser();
        }
    }

    async configureApp() {
        try {
            console.log('\n🔧 Initial Configuration\n');

            const answers = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'userName',
                    message: 'What should Claude call you?',
                    validate: input => input.length >= 1
                },
                {
                    type: 'password',
                    name: 'apiKey',
                    message: 'Enter your Anthropic API key:',
                    validate: input => input.length >= 1
                },
                {
                    type: 'number',
                    name: 'maxHistory',
                    message: 'Maximum number of messages to keep in history (recommended: 10-20):',
                    default: 10,
                    validate: input => input >= 1 && input <= 1000
                },
                {
                    type: 'number',
                    name: 'temperature',
                    message: 'Temperature (0-1): [Default: 1. Creative. 0: Conservative.]',
                    default: 1,
                    validate: input => input >= 0 && input <= 1
                }
            ]);

            const modelChoice = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'model',
                    message: 'Select Claude model to use:',
                    choices: MODELS
                }
            ]);
            
            const systemPrompt = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'systemPrompt',
                    message: 'Enter a system prompt for Claude:',
                    default: 'You are whatever you want to be.'
                }
            ]);

            this.config = {
                userName: answers.userName,
                apiKey: answers.apiKey,
                maxHistory: answers.maxHistory,
                model: modelChoice.model,
                systemPrompt: systemPrompt.systemPrompt,
                temperature: answers.temperature
            };

            await fs.writeFile(CONFIG_FILE, JSON.stringify(this.config, null, 2));
            await this.saveSystemPrompt(modelChoice.model, systemPrompt.systemPrompt);
            
            console.log('\n✅ Configuration saved successfully!\n');
            return;
        } catch (error) {
            console.error('Error during initial configuration:', error);
            process.exit(1);
        }
    }

    async setupAnthropicClient() {
        try {
            this.anthropic = new Anthropic({
                apiKey: this.config.apiKey
            });
        } catch (error) {
            console.error('Anthropic Client Setup Error:', error);
            throw error;
        }
    }

    setupReadline() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    async loadHistory(filePath = HISTORY_FILE) {
        try {
            const data = await fs.readFile(filePath, 'utf8');
            this.messages = JSON.parse(data);
            console.log(`Loaded chat from ${filePath}.`);
        } catch (error) {
            this.messages = [];
        }
    }

    async saveHistory(inputTokens = null, outputTokens = null, price = null) {
        try {
            await fs.writeFile(HISTORY_FILE, JSON.stringify(this.messages, null, 2));
            
            if (inputTokens && outputTokens && price) {
                const date = new Date().toISOString().split('T')[0] + ' ' + new Date().toISOString().split('T')[1].split('.')[0];
                const entry = { 
                    date: date, 
                    inputTokens: inputTokens, 
                    outputTokens: outputTokens, 
                    price: price 
                };
                const data = await fs.readFile(TOKENS_LOG_FILE, 'utf8');
                let entries = JSON.parse(data);
                if (!Array.isArray(entries)) {
                    entries = [];
                }
                entries.push(entry);
                await fs.writeFile(TOKENS_LOG_FILE, JSON.stringify(entries, null, 2));
            }
        } catch (error) {
            console.error('Error saving chat history:', error);
        }
    }
    
    drawBoxedMessage(role, message) {
        const screenWidth = process.stdout.columns-4;
        const boxWidth = MAX_WIDTH-4;
        const screenPadding = Math.floor((screenWidth - boxWidth) / 2);
        const margin = 20;
        
        const topLine = `╭── ${role} ${'─'.repeat(boxWidth - role.length - 5 - margin)}─╮`;
        const messageLines = message.split('\n').map(line => {
            const words = line.split(' ');
            let currentLine = '';
            let lines = [];
            words.forEach(word => {
                if ((currentLine + word).length + margin <= boxWidth - 2) {
                    currentLine += word + ' ';
                } else {
                    lines.push(`│ ${currentLine.trim().padEnd(boxWidth - 2 - margin)} │`);
                    currentLine = word + ' ';
                }
            });
            if (currentLine) {
                lines.push(`│ ${currentLine.trim().padEnd(boxWidth - 2 - margin)} │`);
            }
            return lines;
        }).flat();
        
        const bottomLine = `╰${'─'.repeat(boxWidth - margin)}╯`;
        const marginSpaces = ' '.repeat(margin);
        const paddingSpaces = ' '.repeat(screenPadding);
        
        let formattedMessage;
        if (role === 'Claude') {
            formattedMessage = `${paddingSpaces}${marginSpaces}${topLine}\n${messageLines.map(line => `${paddingSpaces}${marginSpaces}${line}`).join('\n')}\n${paddingSpaces}${marginSpaces}${bottomLine}\n`;
        } else {
            formattedMessage = `${paddingSpaces}${topLine}\n${messageLines.map(line => `${paddingSpaces}${line}`).join('\n')}\n${paddingSpaces}${bottomLine}\n`;
        }

        return formattedMessage;
    }

    async renderMessages() {
        try {
            if (this.messages.length > 0) {
                // console.log('\nPrevious messages:\n');
                this.messages.forEach(msg => {
                    const role = msg.role === 'assistant' ? 'Claude' : this.config.userName;
                    console.log(this.drawBoxedMessage(role, msg.content));
                });
            }
        } catch (error) {
            console.error('Error in renderMessages:', error);
        }
    }

    async promptUser() {
        try {
            this.rl.question(`${this.config.userName} → `, async (input) => {
                try {                    
                    if (input.startsWith('/')) {
                        const command = input.toLowerCase();
                        switch (command) {
                            case '/help':
                                console.log('\nAvailable commands:\n');
                                console.log('/help   - Show this help message');
                                console.log('/save   - Save chat history to a file');
                                console.log('/load   - Load chat history from a file');
                                console.log('/size   - Check context size and message price');
                                console.log('/config - Configuration');
                                console.log('/show   - Show current configuration');
                                console.log('/clear  - Clear chat history');
                                console.log('/exit   - Exit the chat application');
                                console.log('\nAny other input will be sent to Claude as a message.\n');
                                await this.promptUser();
                                return;

                            case '/exit':
                                await this.saveHistory();
                                console.log('\nGoodbye! Chat history saved.');
                                this.rl.close();
                                process.exit(0);
                                return;

                            case '/clear':
                                this.messages = [];
                                // await this.saveHistory();
                                console.log('Chat history cleared.');
                                await this.promptUser();
                                return;

                            case '/config':
                                await this.reConfigure();
                                return;
                                
                            case '/show':
                                console.log('\nCurrent configuration:\n');
                                console.log(`Name: ${this.config.userName}`);
                                console.log(`Model: ${this.config.model}`);
                                console.log(`System Prompt: ${this.config.systemPrompt}`);
                                console.log(`Max History (messages): ${this.config.maxHistory}`);
                                console.log('\nTo change these settings, use the /config command.\n');
                                await this.promptUser();
                                return;
    
                            case '/save':
                                try {
                                    const { fileName } = await inquirer.prompt([{
                                        type: 'input',
                                        name: 'fileName',
                                        message: 'Enter the name for the chat file:',
                                        validate: input => input.length >= 1
                                    }]);
                                    const chatDir = path.join(__dirname, 'chats');
                                    await fs.mkdir(chatDir, { recursive: true });
                                    const todaysDate = new Date().toISOString().split('T')[0].replace(/-/g, '').substring(2);
                                    const filePath = path.join(chatDir, `${todaysDate}-${fileName}.json`);
                                    await fs.writeFile(filePath, JSON.stringify(this.messages, null, 2));
                                    console.log(`Chat history saved as ${fileName}.json in the 'chats' folder.`);
                                } catch (error) {
                                    console.error('Error saving chat history:', error);
                                }
                                await this.promptUser();
                                return;

                            case '/load':
                                try {
                                    const chatDir = path.join(__dirname, 'chats');
                                    const files = await fs.readdir(chatDir);
                                    const { fileName } = await inquirer.prompt([{
                                        type: 'list',
                                        name: 'fileName',
                                        message: 'Select a chat file:',
                                        choices: files
                                    }]);
                                    const filePath = path.join(chatDir, fileName);
                                    await this.loadHistory(filePath);
                                    await this.renderMessages();
                                    await this.promptUser();
                                } catch (error) {
                                    console.error('Error loading chat history:', error);
                                    await this.promptUser();
                                }
                                return;
                                
                            case '/size':
                                try {
                                    // const response = await this.countTokens(this.config.systemPrompt, this.messages);
                                    // const input = response.input_tokens;
                                    // const output = response.output_tokens;
                                    // const tokens = input + output;
                                    // const tokensK = (tokens/1000).toFixed(1);
                                    // const tokensPrice = ((input * inputPrice) + (output * outputPrice));
                                    const inputPrice = MODELS.find(m => m.value === this.config.model).priceInput;
                                    const outputPrice = MODELS.find(m => m.value === this.config.model).priceOutput;
                                    
                                    const totalTokensK = ((TOTAL_INPUT_TOKENS + TOTAL_OUTPUT_TOKENS)/1000).toFixed(1);
                                    const totalTokensPrice = ((TOTAL_INPUT_TOKENS * inputPrice) + (TOTAL_OUTPUT_TOKENS * outputPrice));
                                    
                                    console.log(` ${totalTokensK}k session $${totalTokensPrice.toFixed(3)}`);
                                    console.log();
                                    
                                    
                                } catch (error) {
                                    console.error('Error getting context size:', error);
                                }
                                await this.promptUser();
                                return;

                            default:
                                console.log('Unknown command. Type /help to see available commands.');
                                await this.promptUser();
                                return;
                        }
                    }

                    if (input.trim() === '') {
                        await this.promptUser();
                        return;
                    }
                    
                    this.messages.push({ role: 'user', content: input });
                    
                    // Maintain conversation window                    
                    if (this.messages.length > this.config.maxHistory) {
                        this.messagesTrimmed = this.messages.slice(-this.config.maxHistory);
                    }
                    
                    await this.renderMessages();
                    spinner.start();
                    
                    try {
                        const response = await this.anthropic.messages.create({
                            model: this.config.model,
                            max_tokens: MAX_TOKENS,
                            temperature: this.config.temperature,
                            system: this.config.systemPrompt,
                            messages: this.messagesTrimmed ? this.messagesTrimmed : this.messages,
                        });
                        spinner.stop();
                        
                        const assistantMessage = response.content[0].text;
                        const inputTokens = response.usage.input_tokens;
                        const outputTokens = response.usage.output_tokens;
                        const tokens = inputTokens + outputTokens;
                        TOTAL_INPUT_TOKENS += inputTokens;
                        TOTAL_OUTPUT_TOKENS += outputTokens;
                        
                        console.log('\n' + this.drawBoxedMessage('Claude', assistantMessage));
                        
                        const inputPrice = MODELS.find(m => m.value === this.config.model).priceInput;
                        const outputPrice = MODELS.find(m => m.value === this.config.model).priceOutput;
                        
                        const tokensK = (tokens/1000).toFixed(1);
                        const tokensPrice = ((inputTokens * inputPrice) + (outputTokens * outputPrice));
                        
                        const totalTokensK = ((TOTAL_INPUT_TOKENS + TOTAL_OUTPUT_TOKENS)/1000).toFixed(1);
                        const totalTokensPrice = ((TOTAL_INPUT_TOKENS * inputPrice) + (TOTAL_OUTPUT_TOKENS * outputPrice));
                        
                        console.log(` ${tokensK}k tokens  $${tokensPrice.toFixed(3)}`);
                        console.log(` ${totalTokensK}k session $${totalTokensPrice.toFixed(3)}`);
                        console.log();
                        
                        this.messages.push({ role: 'assistant', content: assistantMessage });
                        
                        await this.saveHistory(inputTokens, outputTokens, tokensPrice);
                    } 
                    catch (error) {
                        spinner.stop();
                        console.error('Error getting response from Claude:', error);
                    }
                    
                    await this.promptUser();
                    
                } catch (error) {
                    console.error('Error processing command:', error);
                    await this.promptUser();
                }
            });
        } catch (error) {
            console.error('Error in promptUser:', error);
            await this.promptUser();
        }
    }
}

// Start the chat application
const chatApp = new ChatApp();
chatApp.init();
