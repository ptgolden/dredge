import styled, { CSSObject } from 'styled-components'

export const TableWrapper = styled.div`
  position: relative;
  height: 100%;
  border: 1px solid #ccc;

  & table {
    table-layout: fixed;
    border-collapse: collapse;
    background-color: white;
  }

  & * {
    font-family: SourceSansPro;
    font-size: 14px;
  }

  & th {
    text-align: left;
  }

  .transcript-row: {
    position: relative;
  }

  .transcript-label {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .transcript-save-marker {
    display: inline-block;
    width: calc(100% - 4px);
    text-align: center;
    line-height: 1.66em
    font-weight: bold;

    text-decoration: none;
  }

  .transcript-save-mraker:hover {
    background-color: #f0f0f0;
    border: 2px solid currentcolor;
    border-radius: 4px;
    line-height: calc(1.66em - 4px);
  }
`

export const TableHeaderWrapper = styled.div<{
  rowHeight: number;
  numRows: number
}>`
  height: ${props => props.numRows * props.rowHeight}px;
  background-color: #f0f0f0;
  border-bottom: 1px solid #ccc;
`

export const TableHeaderRow = styled.div<{
  rowHeight: number,
}>`
  position: relative;
  height: ${props => props.rowHeight}px;
  line-height: ${props => props.rowHeight}px;
`

export const TableBodyWrapper = styled.div<{
  rowHeight: number;
  numRows: number;
  tableWidthSet: boolean;
}>`
  width: 100%;
  height: calc(100% - ${props => props.numRows * props.rowHeight}px);
  background-color: white;
  overflow-y: ${props => props.tableWidthSet ? 'unset' : 'scroll'};

  & .transcript-row:hover {
    background-color: #e6e6e6;
  }

  /*
  & :hover {
    cursor: pointer;
  }
  */
`

export const TableHeaderCell = styled.span<{
  left: number;
  clickable?: boolean;
  css?: CSSObject;
}>`
  position: absolute;
  font-weight: bold;
  user-select: none;
  top: 0;
  bottom: 0;
  left: ${props => props.left}px;
  ${props => props.clickable ? 'cursor: pointer;' : ''}
  ${props => props.css}
`
