import * as t from 'io-ts'
import { fromNullable } from 'io-ts-types'
import * as d3 from 'd3'
import { inflate } from 'pako'

import { ProjectField } from '@dredge/main'

type SeuratMetadata = {
  cellID: string;
  replicateID: string;
  clusterID: string;
}

type SeuratEmbedding = {
  cellID: string;
  umap1: number;
  umap2: number;
}

const seuratEmbeddingsCodec = new t.Type<
  SeuratEmbedding,
  string[]
>(
  'seuratEmbedding',
  (u): u is SeuratEmbedding => {
    // ???
    return true
  },
  (u, c) => {
    if (!Array.isArray(u)) {
      return t.failure(u, c)
    }

    function assertString(val: unknown) {
      if (typeof val !== 'string') {
        throw new Error()
      }

      return val
    }

    try {
      const cellID = assertString(u[0])
          , umap1 = assertString(u[1])
          , umap2 = assertString(u[2])

      return t.success({
        cellID,
        umap1: parseFloat(umap1),
        umap2: parseFloat(umap2),
      })
    } catch (e) {
      return t.failure(u, c)
    }
  },
  () => {
    throw new Error()
  }
)

async function noopPromise<T>(x: T) {
  return x
}

export const embeddings = new ProjectField({
  label: 'Seurat UMAP embeddings',
  required: true,
  cached: false,
  decoder: t.array(seuratEmbeddingsCodec),
  processResponse: async resp => {
    const text = await resp.text()
    return d3.csvParseRows(text).slice(1)
  },
  processValidated: noopPromise,
})

export const differentialExpressions = new ProjectField({
  label: 'Cluster diffential expressions',
  required: true,
  cached: false,
  decoder: t.array(t.type({
    clusterID: t.string,
    transcriptID: t.string,
    pValue: t.number,
    logFC: t.number,
    pctExpressedCluster: t.number,
    pctExpressedOther: t.number,
  })),
  processValidated: noopPromise,
})


const seuratMetadataCodec = new t.Type<SeuratMetadata>(
  'seuratMetadata',
  (u): u is SeuratMetadata => {
    // ???
    return true
  },
  (u, c) => {
    if (!Array.isArray(u)) {
      return t.failure(u, c)
    }

    function assertString(val: unknown) {
      if (typeof val !== 'string') {
        throw new Error()
      }

      return val
    }

    try {
      const cellID = assertString(u[0])
          , replicateID = assertString(u[1])
          , clusterID = assertString(u[2])

      return t.success({
        cellID,
        replicateID,
        clusterID,
      })
    } catch (e) {
      return t.failure(u, c)
    }
  },
  () => {
    throw new Error()
  }
)

export const metadata = new ProjectField({
  label: 'Seurat metadata',
  required: true,
  cached: false,
  decoder: t.array(seuratMetadataCodec),
  processResponse: async resp => {
    const text = await resp.text()
        , rows = d3.csvParseRows(text)
        , header = rows.shift()

    if (header === undefined) {
      throw new Error('CSV file has no data')
    }

    if (header[0] !== '' || header[1] !== 'orig.ident') {
      throw new Error('Not a valid seurat metadata file. First header column should be blank, and second should be `orig.ident`')
    }

    const clusterIDX = header.indexOf('X__dredge_cluster')

    if (clusterIDX === -1) {
      throw new Error('No column in seurat metadata named X__dredge_cluster. Please check file')
    }

    return rows.map(row => [row[0], row[1], row[clusterIDX]])
  },
  processValidated: noopPromise,
})

const seuratExpressionCodec = new t.Type<DataView>(
  'seuratMetadata',
  (u): u is DataView => {
    // ???
    return true
  },
  (u, c) => {
    if (!(u instanceof ArrayBuffer)) {
      return t.failure(u, c)
    }

    const uint8arr = new Uint8Array(u)
        , res = inflate(uint8arr)
        , view = new DataView(res.buffer)

    return t.success(view)
  },
  () => {
    throw new Error()
  }
)

export const expressionData = new ProjectField({
  label: 'Transcript expression data',
  required: true,
  cached: false,
  decoder: seuratExpressionCodec,
  processValidated: noopPromise,
  processResponse: resp => {
    return resp.arrayBuffer()
  },
})

export const transcripts = new ProjectField({
  label: 'Transcripts',
  required: true,
  cached: false,
  decoder: seuratExpressionCodec,
  processValidated: noopPromise,
  processResponse: resp => {
    return resp.text()
  },
})

export const transcriptImages = new ProjectField({
  label: 'Transcript images',
  required: false,
  cached: false,
  decoder: t.array(t.type({
    transcript: t.string,
    filename: t.string,
    title: fromNullable(
      t.union([t.string, t.null]),
      null),
  })),
  processValidated: noopPromise,
  processResponse: resp => {
    console.log(resp)
    return resp.json()
  },
})
