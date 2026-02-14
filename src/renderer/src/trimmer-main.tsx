import './assets/base.css'
import './assets/trimmer.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import AudioTrimmer from './components/AudioTrimmer'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AudioTrimmer />
  </React.StrictMode>
)
