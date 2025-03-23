# Women's March Madness Hub

A real-time dashboard for following NCAA Women's March Madness tournament games, rankings, and social media updates.

## Features

- Live game scores and updates
- Tournament bracket visualization
- NCAA rankings
- Play-by-play updates for live games
- Live betting odds for games in progress
- Twitter feed with March Madness updates
- Responsive design for all devices

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express
- APIs: ESPN API, The Odds API, Twitter API

## Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/womens-march-madness-hub.git
cd womens-march-madness-hub
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
   - Copy `.env.example` to create a new `.env` file:
     ```bash
     cp .env.example .env
     ```
   - Replace the placeholder values in `.env` with your actual API keys:
     - Get a Twitter Bearer Token from the [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
     - Get an Odds API key from [the-odds-api.com](https://the-odds-api.com/)
   - **IMPORTANT**: Never commit your `.env` file or share your API keys publicly

4. Start the development server:
```bash
npm run dev
```

5. Open `http://localhost:3000` in your browser

## Deployment

### Backend Deployment (Render.com)
1. Push your code to GitHub (API keys are not included due to .gitignore)
2. Connect your repository to Render.com
3. In Render dashboard:
   - Go to project settings
   - Click on "Environment"
   - Add your environment variables:
     ```
     TWITTER_BEARER_TOKEN=your_actual_twitter_token
     ODDS_API_KEY=your_actual_odds_api_key
     NODE_ENV=production
     ```
4. Deploy your application

### Alternative Deployment Options

#### Heroku
```bash
# Deploy code
git push heroku main

# Set environment variables
heroku config:set TWITTER_BEARER_TOKEN=your_actual_twitter_token
heroku config:set ODDS_API_KEY=your_actual_odds_api_key
heroku config:set NODE_ENV=production
```

#### Vercel
1. Deploy via Vercel CLI or GitHub integration
2. In Vercel dashboard:
   - Go to Project Settings
   - Click on "Environment Variables"
   - Add each variable:
     - TWITTER_BEARER_TOKEN
     - ODDS_API_KEY
     - NODE_ENV
3. Redeploy if needed

### Environment Variables
- Never commit `.env` file to the repository
- Each deployment platform securely encrypts environment variables
- Variables are injected into your application at runtime
- Different values can be set for development/staging/production environments

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Security

- The `.env` file is listed in `.gitignore` and will not be committed to the repository
- Always use environment variables for sensitive data
- Never hardcode API keys in your code
- Regularly rotate your API keys if you suspect they've been compromised
- Use environment-specific variables for different deployment environments

## License

This project is licensed under the MIT License - see the LICENSE file for details. 