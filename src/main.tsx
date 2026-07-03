import { render } from 'preact'
import { App } from './app.js'
import './styles.css'

const container = document.getElementById('app')
if (container) render(<App />, container)
