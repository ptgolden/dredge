"use strict";

import * as R from 'ramda'
import * as d3 from 'd3'
import { saveAs } from 'file-saver'
import { Action } from 'redux'
import { ThunkAction } from 'redux-thunk'

import {
  TreatmentName,
  PairwiseComparison,
  DifferentialExpression,
  SortPath,
  SortOrder,
  DredgeState,
  TranscriptName
} from './ts_types'


import { projectForView } from './utils'

export type ActionType =
  'LOG' |
  'SET_TITLE' |
  'RESET_LOG' |
  'LOAD_PROJECT_CONFIG' |
  'SET_PAIRWISE_COMPARISON' |
  'GET_DEFAULT_PAIRWISE_COMPARISON' |
  'UPDATE_DISPLAYED_TRANSCRIPT' |
  'UPDATE_SORT_FOR_TREATMENTS' |
  'SET_SAVED_TRANSCRIPTS' |
  'SET_HOVERED_BIN_TRANSCRIPTS' |
  'SET_SELECTED_BIN_TRANSCRIPTS' |
  'SET_BRUSHED_AREA' |
  'SET_HOVERED_TRANSCRIPT' |
  'SET_HOVERED_TREATMENT' |
  'SET_FOCUSED_TRANSCRIPT' |
  'SET_PVALUE_THRESHHOLD' |
  'IMPORT_SAVED_TRANSCRIPTS' |
  'EXPORT_SAVED_TRANSCRIPTS'


/*
Want to say:

const resp = await dispatch('SET_BRUSHED_AREA', {
  coords: [12, 34, 56, 78],
})

// resp is of type SetBrushedAreaResponse
*/


export type AppThunk<ReturnType = void> = ThunkAction<
  Promise<ReturnType>,
  DredgeState,
  unknown,
  Action<string>
>

function delay(time: number): Promise<void> {
  if (time === 0 && window.setTimeout) {
    return new Promise(resolve => setImmediate(resolve))
  } else {
    return new Promise(resolve => setTimeout(resolve, time))
  }
}

interface ForceResortResponse {
  resort: boolean;
}

interface SetPairwiseComparisonResponse extends ForceResortResponse {
  pairwiseData: PairwiseComparison;
}

// Load the table produced by the edgeR function `exactTest`:
// <https://rdrr.io/bioc/edgeR/man/exactTest.html>
export function setPairwiseComparison(
  treatmentAKey: TreatmentName,
  treatmentBKey: TreatmentName
): AppThunk<SetPairwiseComparisonResponse> {
  return async (dispatch, getState) => {
    const project = projectForView(getState())

    const cacheKey = [treatmentAKey, treatmentBKey].toString()
        , cached = project.pairwiseComparisonCache[cacheKey]

    if (cached !== null) {
      await delay(0);

      return {
        pairwiseData: cached,
        resort: true,
      }
    }

    const treatmentA = project.treatments[treatmentAKey]
        , treatmentB = project.treatments[treatmentBKey]

    if (!treatmentA) {
      throw new Error(`No such treatment: ${treatmentAKey}`)
    }

    if (!treatmentB) {
      throw new Error(`No such treatment: ${treatmentBKey}`)
    }

    const urlTemplate = project.config.pairwiseName || './pairwise_tests/%A_%B.txt'

    const fileURLA = new URL(
      urlTemplate.replace('%A', treatmentAKey).replace('%B', treatmentBKey),
      window.location.toString()
    ).href

    const fileURLB = new URL(
      urlTemplate.replace('%A', treatmentBKey).replace('%B', treatmentAKey),
      window.location.toString()
    ).href

    let reverse = false
      , resp

    const [ respA, respB ] = await Promise.all([
      fetch(fileURLA),
      fetch(fileURLB),
    ])

    if (respA.ok) {
      resp = respA
      reverse = true
    } else if (respB.ok) {
      resp = respB
    } else {
      throw new Error(`Could not download pairwise test from ${fileURLA} or ${fileURLB}`)
    }

    const text = await resp.text()

    let minPValue = 1

    const pairwiseMap: Map<TranscriptName, DifferentialExpression> = new Map(text
      .trim()
      .split('\n')
      .slice(1) // Skip header
      .map(row => {
        const [ id, logFC, logATA, _pValue ] = row.split('\t')
            , pValue = parseFloat(_pValue)

        if (pValue !== 0 && !isNaN(pValue) && (pValue < minPValue)) {
          minPValue = pValue
        }

        const name = project.getCanonicalTranscriptLabel(id)

        const [
          treatmentA_AbundanceMean=null,
          treatmentA_AbundanceMedian=null,
          treatmentB_AbundanceMean=null,
          treatmentB_AbundanceMedian=null,
        ] = R.chain(
          abundances => abundances === null
            ? [null, null]
            : [d3.mean(abundances), d3.median(abundances)],
          [project.abundancesForTreatmentTranscript(treatmentAKey, name), project.abundancesForTreatmentTranscript(treatmentBKey, name)]
        )

        return [name, {
          name,
          treatmentA_AbundanceMean,
          treatmentA_AbundanceMedian,
          treatmentB_AbundanceMean,
          treatmentB_AbundanceMedian,
          pValue,
          logFC: (reverse ? -1 : 1 ) * parseFloat(logFC),
          logATA: parseFloat(logATA),
        }]
      }))

    const pairwiseData: PairwiseComparison = Object.assign(pairwiseMap, {
      minPValue,
      fcSorted: R.sortBy(x => x.logFC || 0, Array.from(pairwiseMap.values())),
      ataSorted: R.sortBy(x => x.logFC || 0, Array.from(pairwiseMap.values())),
    })

    return {
      pairwiseData,
      resort: true,
    }
  }
}

interface GetDefaultPairwiseComparisonResponse {
  treatmentA: TreatmentName;
  treatmentB: TreatmentName;
}


export function getDefaultPairwiseComparison(
): AppThunk<GetDefaultPairwiseComparisonResponse>{
  return async (dispatch, getState) => {
    const project = projectForView(getState())
        , { treatments } = project
        , [ treatmentA, treatmentB ] = Object.keys(treatments)

    return {
      treatmentA,
      treatmentB,
    }
  }
}

interface UpdateSortForTreatmentsResponse extends ForceResortResponse {
  sortedTranscripts: Array<DifferentialExpression>;
}

export function updateSortForTreatments(
  sortPath: SortPath | void,
  order: SortOrder | void
): AppThunk<UpdateSortForTreatmentsResponse> {
  return async (dispatch, getState) => {
    const { view } = getState()

    if (view === null) {
      throw new Error('Can\'t update sort for null view')
    }

    const { pairwiseData } = view
        , resolvedSortPath = sortPath || view.sortPath
        , resolvedOrder = order || view.order

    const getter =
      resolvedSortPath === 'name'
        ? (d: DifferentialExpression) => d.name.toLowerCase()
        : (d: DifferentialExpression) => d[resolvedSortPath]

    const comparator = (resolvedOrder === 'asc' ? R.ascend : R.descend)(R.identity)

    const sortedTranscripts = R.sort(
      (a, b) => {
        const aVal = getter(a)
            , bVal = getter(b)

        if (aVal === undefined) return 1
        if (bVal === undefined) return -1

        return comparator(aVal, bVal)
      },
      pairwiseData === null
        ? []
        : Array.from(pairwiseData.values())
    )

    return {
      sortedTranscripts,
      resort: true,
    }
  }
}

interface UpdateDisplayedTranscriptsResponse {
  displayedTranscripts: Array<DifferentialExpression>;
}

function withinBounds(min: number, max: number, value: number | null) {
  if (value === null) return false
  return value >= min && value <= max
}


export function updateDisplayedTranscripts(
): AppThunk<UpdateDisplayedTranscriptsResponse> {
  return async (dispatch, getState) => {
    const { view } = getState()
        , project = projectForView(getState())

    if (view === null) {
      throw new Error('Can\'t run on null view')
    }

    const {
      sortedTranscripts,
      savedTranscripts,
      pairwiseData,
      pValueThreshold,
      brushedArea,
      hoveredBinTranscripts,
      selectedBinTranscripts,
      sortPath,
      order,
    } = view

    if (pairwiseData === null) {
      throw new Error('Can\'t run without pairwise data')
    }


    let listedTranscripts: Set<TranscriptName> = new Set()

    if (pairwiseData && brushedArea) {
      const [ minLogATA, maxLogFC, maxLogATA, minLogFC ] = brushedArea

      const ok = (de: DifferentialExpression) => {
        const { logFC, logATA, pValue } = de

        return (
          withinBounds(0, pValueThreshold, pValue) &&
          withinBounds(minLogATA, maxLogATA, logATA) &&
          withinBounds(minLogFC, maxLogFC, logFC)
        )
      }

      pairwiseData.forEach(transcript => {
        if (ok(transcript)) {
          listedTranscripts.add(transcript.name)
        }
      })
    } else if (selectedBinTranscripts) {
      listedTranscripts = selectedBinTranscripts
    } else if (hoveredBinTranscripts) {
      listedTranscripts = hoveredBinTranscripts
    } else {
      listedTranscripts = savedTranscripts
    }

    let displayedTranscripts = sortedTranscripts
      .filter(({ name }) => listedTranscripts.has(name))

    const comparator = (order === 'asc' ? R.ascend : R.descend)(R.identity)

    const alphaSort = R.sort((a: DifferentialExpression, b: DifferentialExpression) =>
      comparator(a.name.toLowerCase(), b.name.toLowerCase()))

    const extraTranscripts: Array<DifferentialExpression> = Array.from(listedTranscripts)
      .filter(name => !pairwiseData.has(name))
      .map(name => ({
        name: project.getCanonicalTranscriptLabel(name),

        treatmentA_AbundanceMean: null,
        treatmentA_AbundanceMedian: null,
        treatmentB_AbundanceMean: null,
        treatmentB_AbundanceMedian: null,
        pValue: null,
        logFC: null,
        logATA: null,
      }))

    displayedTranscripts = [...displayedTranscripts, ...alphaSort(extraTranscripts)]

    // If anything but the name is being sorted on (i.e. any of the fields
    // which would have a numerical value), then just add all of these extra
    // transcripts to the bottom of the list. Otherwise, resort the whole list
    // alphabetically. (This routine used to combine the two alphabetically
    // sorted lists progressively, but now we just resort the whole concatenated
    // list. If it's a bottleneck, we can go back to doing the old way.

    if (sortPath === 'name') {
      displayedTranscripts = alphaSort(displayedTranscripts)
    }

    return { displayedTranscripts }
  }
}

function getGlobalWatchedGenesKey() {
  return window.location.pathname + '-watched'
}

export function setSavedTranscripts(
  savedTranscripts: Array<TranscriptName>
): AppThunk<ForceResortResponse> {
  return async (dispatch, getState) => {
    if (R.path(['view', 'source', 'key'], getState()) === 'global') {
      const key = getGlobalWatchedGenesKey()
          , savedTranscriptsStr = JSON.stringify([...savedTranscripts])

      localStorage.setItem(key, savedTranscriptsStr)
    }

    return { resort: true }
  }
}

type ImportedTranscript = [
  /* name: */string,
  /* canonicalName: */string
]

interface ImportSavedTranscriptsResponse {
  imported: Array<ImportedTranscript>;
  skipped: Array<string>;
}

export function importSavedTranscripts(
  text: string
): AppThunk<ImportSavedTranscriptsResponse> {
  return async (dispatch, getState) => {
    const { view } = getState()

    if (view === null) {
      throw new Error('Can\'t import transcripts without active view')
    }
    const rows = d3.tsvParseRows(text.trim())

    if (R.path([0, 0], rows) === 'Gene name') {
      rows.shift()
    }

    const transcriptsInFile = rows.map(row => row[0])
        , { getCanonicalTranscriptLabel } = projectForView(getState())
        , newWatchedTranscripts = []
        , imported: Array<ImportedTranscript> = []
        , skipped: Array<string> = []

    for (const t of transcriptsInFile) {
      const canonicalName = getCanonicalTranscriptLabel(t)

      if (canonicalName) {
        imported.push([t, canonicalName])
        newWatchedTranscripts.push(canonicalName)
      } else {
        skipped.push(t)
      }
    }

    // FIXME
    /*
    const existingWatchedTranscripts = view.savedTranscripts
    await dispatch(Action.SetSavedTranscripts(
      [...newWatchedTranscripts, ...existingWatchedTranscripts]
    ))
    */

    return {
      imported,
      skipped,
    }
  }
}

export function exportSavedTranscripts(
): AppThunk<void> {
  return async (dispatch, getState) => {
    const { view } = getState()

    if (view === null) {
      throw new Error('Can\'t call from null view')
    }

    const { comparedTreatments, displayedTranscripts } = view

    if (comparedTreatments === null || displayedTranscripts === null) {
      return
    }

    const [ treatmentA, treatmentB ] = comparedTreatments

    const header = [
      'Gene name',
      'pValue',
      'logATA',
      'logFC',
      `${treatmentA} mean abundance`,
      `${treatmentA} median abundance`,
      `${treatmentB} mean abundance`,
      `${treatmentB} median abundance`,
    ]

    const formatNumRow = (x: number | null) =>
      x === null
        ? ''
        : x.toString()

    const rows = displayedTranscripts.map(row => ([
      row.name,
      formatNumRow(row.pValue),
      formatNumRow(row.logATA),
      formatNumRow(row.logFC),
      formatNumRow(row.treatmentA_AbundanceMean),
      formatNumRow(row.treatmentA_AbundanceMedian),
      formatNumRow(row.treatmentB_AbundanceMean),
      formatNumRow(row.treatmentB_AbundanceMedian),
    ]))

    const tsv = d3.tsvFormatRows([header, ...rows])

    const blob = new Blob([ tsv ], { type: 'text/tab-separated-values' })

    saveAs(blob, 'saved-transcripts.tsv')
  }
}