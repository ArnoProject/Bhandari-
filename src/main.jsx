import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import DriverApp from './DriverApp'

const isDriver = window.location.pathname.startsWith('/driver')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isDriver ? <DriverApp /> : <App />}
  </React.StrictMode>
)
