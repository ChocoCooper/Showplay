# Streamzy

Streamzy is a web-based streaming service that fetches and displays movies and TV shows using The Movie Database (TMDB) API. It features a responsive UI, search functionality, video playback via external servers, and ad-blocking to filter unwanted content. The backend is powered by Netlify Functions to securely proxy TMDB API requests.

**Live Demo**: [streamzy1.netlify.app](https://streamzy1.netlify.app)

## Features
- **Homepage**: Displays trending movies, TV shows, anime, and K-dramas in sliders, with a preview slideshow.
- **Search**: Search for movies and TV shows with debounced input and ad-filtered results.
- **Video Playback**: Play media via external servers with server selection and season/episode navigation for TV shows.
- **Recently Watched**: Persist and display recently watched items using localStorage.
- **Ad-Blocking**: Filter ad-related domains and keywords from search results and video iframes.
- **Responsive Design**: Mobile-friendly UI with Bootstrap and custom styling.
- **PWA Support**: Installable as a Progressive Web App.

## Prerequisites
- [Node.js](https://nodejs.org/) (v18 or later)
- [Netlify CLI](https://docs.netlify.com/cli/get-started/) (for local development and deployment)
- A [TMDB API key](https://www.themoviedb.org/documentation/api)

## Setup
1. **Clone the Repository**:
   ```bash
   git clone https://github.com/ChocoCooper/streamzy.git
   cd streamzy
