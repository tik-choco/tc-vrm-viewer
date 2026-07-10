import { render } from 'preact'
import { App } from './app.js'
import './styles.css'
import { writeAppManifest } from './lib/appManifest.js'

const container = document.getElementById('app')
if (container) {
  render(<App />, container)
  writeAppManifest({
    app: 'tc-vrm-viewer',
    publishes: [],
    consumes: [],
    reads: ['tc-storage-did-identity-v1', 'tc-chat-did-identity-v1'],
  })
}
