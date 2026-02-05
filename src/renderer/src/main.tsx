import './assets/main.css'
import './assets/base.css'

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

/**
 * Main Entry Point for the Renderer Process (React).
 * This mounts the React application into the DOM element with id 'root'.
 */
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
