import { useDispatch } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'

import { reducer as logReducer } from '@dredge/log'
import { reducer as projectsReducer } from '@dredge/projects'



export default function createStore() {
  return configureStore({
    reducer: {
      log: logReducer,
      projects: projectsReducer,
    },
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware({
        serializableCheck: false,
        immutableCheck: false,
      }),
  })
}

export type AppStore = ReturnType<typeof createStore>

export type AppDispatch = AppStore["dispatch"]
export const useAppDispatch = () => useDispatch<AppDispatch>()

export type AppState = ReturnType<AppStore["getState"]>



/*
export default function _createStore() {

  return store

  let lastTriggeredSort = []

  return configureStore({
    reducer: {
      log: logReducer,
      view: viewReducer,
    },
    /*
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware().concat(sortingMiddleware)
      */

    /*
    applyMiddleware(
      typedAsyncActionMiddleware(),
      ({ dispatch, getState }) => next => action => {
        const res = next(action)

        const updateSort = (
          action.readyState &&
          action.readyState.case({
            Success: R.T,
            _: R.F,
          }) &&
          action.type._name === 'SetPairwiseComparison'
        )

        if (updateSort) {
          dispatch(Action.UpdateSortForTreatments(null, null))
          return res
        }

        const {
          // pairwiseData,
          sortedTranscripts,
          order,
          sortPath,
          savedTranscripts,
          pValueThreshold,
          brushedArea,
          selectedBinTranscripts,
          hoveredBinTranscripts,
        } = (getState().view || {})

        const checkResort = (
          action.readyState &&
          action.readyState.case({
            Success: R.T,
            _: R.F,
          }) &&
          action.readyState.response.resort &&
          // pairwiseData &&
          sortedTranscripts
        )

        if (checkResort) {
          const triggerResort = (
            // lastTriggeredSort.pairwiseData !== pairwiseData ||
            lastTriggeredSort.sortedTranscripts !== sortedTranscripts ||
            lastTriggeredSort.order !== order ||
            lastTriggeredSort.sortPath !== sortPath ||
            lastTriggeredSort.savedTranscripts !== savedTranscripts ||
            lastTriggeredSort.pValueThreshold !== pValueThreshold ||
            lastTriggeredSort.brushedArea !== brushedArea ||
            lastTriggeredSort.selectedBinTranscripts !== selectedBinTranscripts ||
            (
              selectedBinTranscripts === null &&
              lastTriggeredSort.hoveredBinTranscripts !== hoveredBinTranscripts
            )
          )

          if (!triggerResort) return

          dispatch(Action.UpdateDisplayedTranscripts(null, null))
          lastTriggeredSort = {
            // pairwiseData,
            sortedTranscripts,
            order,
            sortPath,
            savedTranscripts,
            pValueThreshold,
            brushedArea,
            selectedBinTranscripts,
            hoveredBinTranscripts,
          }
        }

        return res
      }
    )
  })
}
*/
