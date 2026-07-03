import type { JSX } from 'preact'
import type { VrmMeta } from '../viewer/vrmLoader.js'

type MetaPanelProps = {
  meta?: VrmMeta
}

export function MetaPanel({ meta }: MetaPanelProps): JSX.Element {
  if (!meta) {
    return <p class="panel-empty">モデルを読み込むとメタ情報が表示されます</p>
  }
  return (
    <dl class="meta-panel">
      <dt>名前</dt>
      <dd>{meta.name || '不明'}</dd>
      <dt>作者</dt>
      <dd>{meta.authors.length ? meta.authors.join(', ') : '不明'}</dd>
      <dt>ライセンス</dt>
      <dd>
        {meta.licenseUrl ? (
          <a href={meta.licenseUrl} target="_blank" rel="noreferrer">
            {meta.licenseName || meta.licenseUrl}
          </a>
        ) : (
          meta.licenseName || '不明'
        )}
      </dd>
    </dl>
  )
}
