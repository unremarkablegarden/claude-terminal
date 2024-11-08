# Claude Terminal

![Claude Spiral](https://raw.githubusercontent.com/unremarkablegarden/claude-terminal/refs/heads/main/claude-terminal.jpg)

Available commands:

/help   - Show this help message  
/save   - Save chat history to a file  
/load   - Load chat history from a file  
/size   - Check context size and message price  
/config - Configuration  
/show   - Show current configuration  
/clear  - Clear chat history  
/exit   - Exit the chat application  
  
Any other input will be sent to Claude as a message.  
    
/config  
 - Name  
 - API Key  
 - Max history  
 - Model  
 - System Prompt  
 - Temperature  
  
Node.js based CLI to talk to Claude.  
  
→ npm i  
→ node chat.js  
  
Let's you set system prompt, temp, etc. 
Let's you save a context/conversation as JSON.  
Keeps a log of all your system prompts.  
Shows you the current input/output tokens per message and for the session.  
Calculates the price based on model for tokens spent.  
Keeps a JSON log of all your tokens spent and costs.  
  
Recommend you run it in https://github.com/Swordfish90/cool-retro-term  
