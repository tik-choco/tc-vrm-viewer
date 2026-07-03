import type { JSX } from 'preact'
import type { VrmMeta } from '../viewer/vrmLoader.js'

type MetaPanelProps = {
  meta?: VrmMeta
}

export function MetaPanel({ meta }: MetaPanelProps): JSX.Element {
  if (!meta) {
    return <p class="panel-empty">Load a model to see its metadata</p>
  }
  return (
    <dl class="meta-panel">
      <dt>Name</dt>
      <dd>{meta.name || 'Unknown'}</dd>
      <dt>Authors</dt>
      <dd>{meta.authors.length ? meta.authors.join(', ') : 'Unknown'}</dd>
      <dt>License</dt>
      <dd>
        {meta.licenseUrl ? (
          <a href={meta.licenseUrl} target="_blank" rel="noreferrer">
            {meta.licenseName || meta.licenseUrl}
          </a>
        ) : (
          meta.licenseName || 'Unknown'
        )}
      </dd>
    </dl>
  )
}
