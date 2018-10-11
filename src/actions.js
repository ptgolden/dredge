"use strict";

const R = require('ramda')
    , d3 = require('d3')
    , { makeTypedAction } = require('org-async-actions')
    , TrieSearch = require('trie-search')
    , saveAs = require('file-saver')

function isIterable(obj) {
  return Symbol.iterator in obj
}

const Action = module.exports = makeTypedAction({
  Initialize: {
    exec: initialize,
    request: {},
    response: {},
  },

  Log: {
    exec: R.always({}),
    request: {
      message: val => [].concat(val).every(val => typeof val === 'string'),
    },
    response: {},
  },

  CheckCompatibility: {
    exec: checkCompatibility,
    request: {},
    response: {},
  },

  LoadAvailableProjects: {
    exec: loadAvailableProjects,
    request: {},
    response: {
      // projects: Type.ListOf(Object),
      projects: Object,
    },
  },

  ViewProject: {
    exec: R.always({}),
    request: {
      projectBaseURL: String,
    },
    response: {},
  },

  ChangeProject: {
    exec: changeProject,
    request: {
      projectBaseURL: String,
    },
    response: {},
  },

  SetPairwiseComparison: {
    exec: setPairwiseComparison,
    request: {
      TreatmentA: String,
      TreatmentB: String,
    },
    response: {
      pairwiseData: d => d.constructor === Map,
    },
  },

  SetSavedGenes: {
    exec: setSavedGenes,
    request: {
      geneNames: isIterable,
    },
    response: {
    },
  },

  SetBrushedGenes: {
    exec: R.always({}),
    request: {
      geneNames: isIterable,
    },
    response: {
    },
  },

  SetHoveredGene: {
    exec: R.always({}),
    request: {
      geneName: d => typeof d === 'string' || d === null,
    },
    response: {
    },
  },

  SetFocusedGene: {
    exec: R.always({}),
    request: {
      geneName: String,
    },
    response: {
    },
  },

  ImportSavedGenes: {
    exec: importSavedGenes,
    request: {
      file: Object,
    },
    response: {},
  },

  ExportSavedGenes: {
    exec: exportSavedGenes,
    request: {},
    response: {},
  },
})

function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time))
}

function initialize() {
  return async (dispatch, getState) => {
    dispatch(Action.Log('Checking browser compatibility...'))
    await dispatch(Action.CheckCompatibility)
    dispatch(Action.Log('Browser compatible.'))
    dispatch(Action.Log('Loading available projects...'))
    await dispatch(Action.LoadAvailableProjects)
    dispatch(Action.Log('Finished initialization. Starting application...'))

    const projectKey = Object.keys(getState().projects)[0]

    dispatch(Action.ChangeProject(projectKey))

    return {}
  }
}

function changeProject(projectURL) {
  return async (dispatch, getState) => {
    await dispatch(Action.ViewProject(projectURL))

    const project = getState().projects[projectURL]
        , { treatments } = project
        , [ treatmentA, treatmentB ] = Object.keys(treatments).slice(3)

    const persistedSavedGenes = JSON.parse(localStorage[projectURL + '-watched'] || '[]')

    dispatch(Action.SetPairwiseComparison(treatmentA, treatmentB))
    dispatch(Action.SetSavedGenes(persistedSavedGenes))

    return {}
  }
}

function checkCompatibility() {
  return () => {

    if (!window.indexedDB) {
      throw new Error('Browser does not support IndexedDB standard. Cannot run application.')
    }

    if (!window.Blob) {
      throw new Error('Browser does not support Blob standard. Cannot run application.')
    }

    return {}
  }
}

function loadAvailableProjects() {
  return async dispatch => {
    const loadedProjects = {}

    const projectsResp = await fetch('projects.json', {
      headers: new Headers({
        'Cache-Control': 'no-cache',
      }),
    })

    if (!projectsResp.ok) {
      throw new Error("No project.json file available")
    }

    let projects

    try {
      projects = await projectsResp.json()
      if (!Array.isArray(projects)) throw new Error()
      dispatch(Action.Log(`Loading projects: ${projects.join(', ')}`))
    } catch (e) {
      throw new Error("projects.json file is malformed")
    }

    await Promise.all(projects.map(async projectBaseURL => {
      const log = message => dispatch(Action.Log(`${projectBaseURL}: ${message}`))
          , project = {}

      const projectMetadataResp = await fetch(`${projectBaseURL}/project.json`, {
        headers: new Headers({
          'Cache-Control': 'no-cache',
        }),
      })

      if (!projectMetadataResp.ok) {
        log(`Could not download \`project.json\` file from ${projectBaseURL}/project.json. Aborting.`)
        return
      }

      try {
        project.metadata = await projectMetadataResp.json()
        log(`Loaded project metadata`)
      } catch (e) {
        log(`${projectBaseURL}/project.json is not a valid JSON file. Aborting.`)
        return
      }

      const treatmentsResp = await fetch(`${projectBaseURL}/treatments.json`, {
        headers: new Headers({
          'Cache-Control': 'no-cache',
        }),
      })

      if (!treatmentsResp.ok) {
        log(`Could not download \`treatments.json\` file from ${projectBaseURL}/treatments.json. Aborting.`)
        return
      }

      try {
        project.treatments = await treatmentsResp.json()
        log(`Loaded treatments`)
      } catch (e) {
        log(`${projectBaseURL}/treatments.json is not a valid JSON file. Aborting.`)
        return
      }

      // TODO: Validate all of treatments, aliases, averages, medians

      log('Checking for additional project statistics...')

      await fetch(`${projectBaseURL}/gene_whitelist.txt`).then(async resp => {
        if (!resp.ok) {
          log('No gene whitelist found')
          project.geneWhitelist = null
          return
        }

        const whitelist = await resp.text()
        project.geneWhitelist = new Set(whitelist.split('\n'))

        log('Loaded gene whitelist')
      })

      await fetch(`${projectBaseURL}/gene_aliases.csv`).then(async resp => {
        if (!resp.ok) {
          log('No gene aliases found')
          project.geneAliases = {}
          return
        }

        const aliases = await resp.text()

        try {
          project.geneAliases = R.pipe(
            R.split('\n'),
            R.map(R.pipe(
              R.split(','),
              arr => [arr[0], arr.slice(1)]
            )),
            R.fromPairs,
          )(aliases)

          log('Loaded gene aliases')

        } catch (e) {
          log('Gene alias file malformed')
          return
        }
      })

      await fetch(`${projectBaseURL}/treatment_rpkms.tsv`).then(async resp => {
        if (!resp.ok) {
          log('No RPKM mean measurements found')
          project.rpkmsForTreatmentGene = R.always(null)
          return
        }

        let rpkms = (await resp.text()).split('\n')

        try {
          const replicates = rpkms.shift().split('\t').slice(1)
              , genes = []

          rpkms = rpkms.map(row => {
            row = row.split('\t')
            genes.push(row.shift())
            return row.map(parseFloat)
          })

          const geneIndices = R.invertObj(genes)
              , replicateIndices = R.invertObj(replicates)

          project.genes = genes

          project.rpkmsForTreatmentGene = (treatmentID, geneName) => {
            const treatment = project.treatments[treatmentID]
                , geneIdx = geneIndices[geneName]

            return treatment.replicates.map(replicateID => {
              const replicateIdx = replicateIndices[replicateID]
              return rpkms[geneIdx][replicateIdx]
            })
          }

          log('Loaded gene RPKM measurements')
        } catch (e) {
          log('Gene RPKM measurements file malformed')
        }
      })

      await fetch(`${projectBaseURL}/icons.svg`, {
        headers: new Headers({
          'Cache-Control': 'no-cache',
        }),
      }).then(async resp => {
        if (!resp.ok) {
          log('No SVG icon found')
          project.svg = null
          return
        }

        try {
          const svg = await resp.text()
              , parser = new DOMParser()
              , svgDoc = parser.parseFromString(svg, 'image/svg+xml')
              , iterator = svgDoc.createNodeIterator(svgDoc, NodeFilter.SHOW_ELEMENT)
              , treatmentNames = new Set(Object.keys(project.treatments))

          let curNode

          ;[...svgDoc.querySelectorAll('title')].forEach(el => {
            el.parentNode.removeChild(el)
          })

          const anchorsToRemove = []

          while ( (curNode = iterator.nextNode()) ) {
            switch (curNode.nodeName.toLowerCase()) {
              case 'path':
              case 'rect':
              case 'circle':
              case 'elipse':
              case 'polyline':
              case 'polygon': {
                let treatment = null

                const popTreatmentFromAttr = attr => {
                  treatment = curNode.getAttribute(attr)
                  if (treatmentNames.has(treatment)) {
                    curNode.removeAttribute(attr)
                    return true
                  }
                  return false
                }

                popTreatmentFromAttr('id') || popTreatmentFromAttr('name')

                if (treatment) {
                  const { label } = project.treatments[treatment]

                  curNode.setAttribute('data-treatment', treatment)

                  const titleEl = document.createElement('title')
                  titleEl.textContent = label || treatment

                  curNode.appendChild(titleEl)
                  treatmentNames.delete(treatment)

                  // Illustrator, for some reason, makes all paths the child of
                  // an anchor tag. That messes up our clicking business. We
                  // could probably preventDefault() or stopPropagation()
                  // somewhere, but I'm just removing them here.
                  const replaceParent = (
                    curNode.parentNode.nodeName.toLowerCase() === 'a' &&
                    curNode.parentNode.children.length === 1
                  )

                  if (replaceParent) {
                    anchorsToRemove.push(curNode.parentNode)
                  }
                }

                break;
              }
            }

            // Remove ID, since multiple instances of this SVG will be in the
            // document. Alternatively, the whole thing could always be wrapped
            // in an iframe, but that would require inter-frame communication,
            // which seems like a pain in the ass.
            curNode.removeAttribute('id')
          }

          anchorsToRemove.forEach(el => {
            el.replaceWith(el.children[0])
          })

          project.svg = svgDoc.rootElement.outerHTML
          log('Loaded SVG icon')
        } catch (e) {
          project.svg = null
          log('SVG icon file malformed')
        }
      })


      await fetch(`${projectBaseURL}/grid.csv`, {
        headers: new Headers({
          'Cache-Control': 'no-cache',
        }),
      }).then(async resp => {
        if (!resp.ok) {
          log('No grid configuration found')
          project.grid = null
          return
        }


        try {
          let grid = d3.csvParseRows(await resp.text())

          grid = grid.map(row => row.map(treatment => {
            if (!treatment) return null

            if (!project.treatments.hasOwnProperty(treatment)) {
              throw new Error(`Treatment ${treatment} not in project ${projectBaseURL}`)
            }

            return treatment
          }))

          project.grid = grid;

          log('Loaded grid configuration')
        } catch (e) {
          project.grid = null
          log('Grid configuration file malformed')
        }

      })

      log('Finished loading')

      project.baseURL = projectBaseURL
      project.pairwiseComparisonCache = {}
      loadedProjects[projectBaseURL] = project

      const corpus = {}
          , ts = new TrieSearch()

      project.genes.forEach(gene => {
        corpus[gene] = gene
      })

      Object.entries(project.geneAliases || {}).forEach(([ gene, aliases ]) => {
        aliases.forEach(alias => {
          corpus[alias] = gene
        })
      })

      ts.addFromObject(corpus);

      project.searchGenes = name => ts.get(name)
    }))

    const sortedLoadedProjects = {}

    projects.forEach(project => {
      if (loadedProjects.hasOwnProperty(project)) {
        sortedLoadedProjects[project] = loadedProjects[project]
      }
    })

    return { projects: sortedLoadedProjects }
  }
}

// Load the table produced by the edgeR function `exactTest`:
// <https://rdrr.io/bioc/edgeR/man/exactTest.html>
function setPairwiseComparison(treatmentAKey, treatmentBKey) {
  return async (dispatch, getState) => {
    const { project } = getState().currentView

    const cached = project.pairwiseComparisonCache[[treatmentAKey, treatmentBKey]]

    if (cached) {
      await delay(0);

      return {
        pairwiseData: cached,
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

    const comparisonFileKey = [
      treatmentA.fileKey || treatmentAKey,
      treatmentB.fileKey || treatmentBKey,
    ]

    const fileURLA = `${project.baseURL}/pairwise_tests/${comparisonFileKey.join('_')}.txt`
        , fileURLB = `${project.baseURL}/pairwise_tests/${comparisonFileKey.reverse().join('_')}.txt`

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

    const pairwiseData = text
      .trim()
      .split('\n')
      .slice(1) // Skip header
      .map(row => {
        const [ label, logFC, logCPM, pValue ] = row.split('\t')

        return [label, {
          label,
          logFC: (reverse ? -1 : 1 ) * parseFloat(logFC),
          logCPM: parseFloat(logCPM),
          pValue: parseFloat(pValue),
        }]
      })

    return { pairwiseData: new Map(pairwiseData) }
  }
}

function setSavedGenes(savedGenes) {
  return (dispatch, getState) => {
    const key = getState().currentView.project.baseURL + '-watched'
        , savedGenesStr = JSON.stringify([...savedGenes])

    localStorage.setItem(key, savedGenesStr)

    return {}
  }
}

function importSavedGenes(file) {
  return (dispatch, getState) => new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = async e => {
      const text = e.target.result

      try {
        const importedWatchedGenes = text.trim().split('\n')

        // TODO: Filter out those things that aren't in `project.genes`

        const existingWatchedGenes = getState().currentView.savedGenes

        await dispatch(Action.SetSavedGenes(
          [...importedWatchedGenes, ...existingWatchedGenes]
        ))

        resolve({})
      } catch (e) {
        reject('didn\'t work')
      }
    }

    reader.readAsText(file)
  })
}

function exportSavedGenes() {
  return (dispatch, getState) => {
    const { savedGenes } = getState().currentView

    const blob = new Blob([ [...savedGenes].join('\n') ], { type: 'text/plain' })

    saveAs(blob, 'saved-genes.txt')

    return {}
  }
}
