"use strict";

const h = require('react-hyperscript')
    , R = require('ramda')
    , styled = require('styled-components').default
    , { connect } = require('react-redux')
    , MAPlot = require('./MAPlot')
    , TreatmentSelector = require('./TreatmentSelector')
    , Action = require('../actions')
    , Table = require('./Table')
    , WatchedGenes = require('./WatchedGenes')
    , InfoBox = require('./InfoBox')
    , PValueSelector = require('./PValueSelector')

const ViewerContainer = styled.div`
  display: grid;
  height: 100%;

  grid-template-columns: repeat(24, 1fr);
  grid-template-rows: repeat(12, 1fr);
`

const GridArea = styled.div`
  grid-column: ${ props => props.column };
  grid-row: ${ props => props.row };
`

function Viewer({
  dispatch,
  treatmentA,
  treatmentB,
}) {
  return (
    h(ViewerContainer, [
      h(GridArea, { column: '1 / span 10', row: '1 / span 1' },
        treatmentA && h(TreatmentSelector, {
          selectedTreatment: treatmentA,
          onSelectTreatment: treatment => {
            dispatch(Action.SetPairwiseComparison(treatment, treatmentB))
          },
        })
      ),

      h(GridArea, { column: '1 / span 10', row: '11 / span 2' },
        treatmentB && h(TreatmentSelector, {
          selectedTreatment: treatmentB,
          onSelectTreatment: treatment => {
            dispatch(Action.SetPairwiseComparison(treatmentA, treatment))
          },
        })
      ),


      h(GridArea, { column: '1 / span 9', row: '2 / span 9', ['data-area']: 'plot' },
        h(MAPlot)
      ),


      h(GridArea, { column: '10 / span 1', row: '2 / span 9' },
        h(PValueSelector),
      ),


      h(GridArea, { column: '12 / span 13', row: '1 / span 1' },
        h(WatchedGenes)
      ),

      h(GridArea, { column: '12 / span 13', row: '2 / span 8', ['data-area']: 'table' },
        h(Table)
      ),

      h(GridArea, { column: '12 / span 13', row: '10 / span 3' },
        h(InfoBox)
      ),
    ])
  )
}

module.exports = connect(state => {
  const comparedTreatments = R.path(['currentView', 'comparedTreatments'], state)
      , [ treatmentA, treatmentB ] = comparedTreatments || []

  return { treatmentA, treatmentB }
})(Viewer)
