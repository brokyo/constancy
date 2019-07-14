// create references to html elements
var page = document.documentElement
var body = document.getElementsByTagName('body')[0]

var statement = document.createElement('span')
statement.setAttribute("id", "statement")

var intention = document.createElement('div')
intention.setAttribute("id", "intention")
intention.append(statement)

// style core elements
page.style.paddingBottom = "65px"

intention.style.position = 'fixed'
intention.style.bottom = "0"
intention.style.left = "0"
intention.style.width = '100%'
intention.style.height = '105px'
intention.style.padding = '0'
intention.style.margin = '0'
intention.style.borderRadius = '0'
intention.style.backgroundColor = '#FFFFFF'
intention.style["z-index"] = "9999999999"

statement.style["font-size"] = "12px"

// global p5 object | allows other methods to run p5 operations
var globalP5, globalStorage

// Attach bar to DOM
function addBar() {
	statementText = globalStorage.intention
	statementTextNode = document.createTextNode(statementText)
	statement.append(statementTextNode)

	body.append(intention)
}

// Set up Chrome background.js message listeners
function addEventListeners() {
	chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
		switch (request.control) {
			case 'updateData':
				updateData(request.data)
				break
			case 'intervalRefresh':
				intervalRefresh()
				break
			case 'endSession':
				endExtension()
				break
		}
		return true
	})
}

// Browser stuff teardown
function removeBar() {

}

// P5 kickoff
function startP5() {

	var sketch = function(p5) {

		p5.setup = function() {
			var canvas = p5.createCanvas(window.innerWidth, 50)
			var intentionNode = document.getElementById('intention')
			canvas.parent(intentionNode)
			
			p5.noLoop()
		}

		p5.draw = function() {
			p5.background(255)

			// shared Values
			var intentionStart = globalStorage.start
			var intentionEnd = globalStorage.end
			var canvasHeight = 50
			var canvasWidth = window.innerWidth
			var tabHeight

			// draw browsing history
			globalStorage.tabs.forEach((tab, tabIndex) => {
				tab.history.forEach((site, siteIndex) => {

					// create visit end time if one doesn't already exist
					let siteEndTime
					if (!site.end) {
						siteEndTime = Date.now()
					} else {
						siteEndTime = site.end
					}

					// calculate height of each tab
					// if (globalStorage.tabs.length < 5) {
					tabHeight = canvasHeight / globalStorage.tabs.length
					// } else {
					// 	height = globalStorage.tabs.length * 10
					// 	tabHeight = 10
						// p5.resizeCanvas(window.innerWidth, height)
					// }


					// draw visit history
					let siteHeight = tabHeight * 0.7
					let tabBuffer = tabHeight * 0.15

					var x = p5.map(site.start, intentionStart, intentionEnd, 0, canvasWidth)
					var y = 50 - (tabHeight * (tabIndex + 1)) + tabBuffer
					var w = p5.map(siteEndTime, intentionStart, intentionEnd, 0, canvasWidth) - x
					var h = siteHeight

					p5.stroke('#cccccc')
					p5.fill('white')
					// console.log('tab:', tabIndex, 'site:', siteIndex, 'y:', y, 'x:', x, 'w:', w, 'h:', h)
					p5.rect(x, y, w, h, 20)


					// draw active pathing
					if (site.focusPeriods.length > 0) {
						site.focusPeriods.forEach((period, periodIndex) => {

							// create period end time if it doesn't exist 
							let periodEndTime
							if (!period.end) {
								periodEndTime = Date.now()
							} else {
								periodEndTime = period.end
							}

							let periodHeight = tabHeight * 0.7
							let periodBuffer = tabHeight * 0.15

							var x = p5.map(period.start, intentionStart, intentionEnd, 0, canvasWidth)
							var y = 50 - (tabHeight * (tabIndex + 1)) + periodBuffer
							var w = p5.map(periodEndTime, intentionStart, intentionEnd, 0, canvasWidth) - x
							var h = periodHeight

							// console.log('tab:', tabIndex, 'site:', siteIndex, 'period:', periodIndex, 'y:', y, 'x:', x, 'w:', w)
							p5.stroke('#A42020')
							p5.fill('#A42020')
							p5.rect(x, y, w, h, 20)

						})
					}
				})
			})

			// draw focus history
			globalStorage.focusLost.forEach((period, periodIndex) => {

				// set period end time if it doesn't yet exist
				let periodEndTime
				if(!period.end) {
					periodEndTime = Date.now()
				} else {
					periodEndTime = period.end
				}

				var x = p5.map(period.start, intentionStart, intentionEnd, 0, canvasWidth)
				var y = 0
				var w = p5.map(periodEndTime, intentionStart, intentionEnd, 0, canvasWidth) - x
				var h = 50

				// console.log('lost focus period:', periodIndex, 'w:', w, 'h:', h)
				let focusColor = 'rgba(30, 30, 30, 0.6)' 
				p5.stroke(focusColor)
				p5.fill(focusColor)
				p5.rect(x, y, w, h)
			})
		}

		p5.windowResized = function() {
			p5.resizeCanvas(window.innerWidth, 50)
		}
	}

	globalP5 = new p5(sketch)
}

function stopP5() {

}

function updateP5() {
	globalP5.redraw()
}


function updateData(newData) {
	globalStorage = newData
	updateP5()
}


// TODO: is this the best way to do this?
// get from chrome extension storage then update global store
function updateIntentionData() {
	return new Promise((resolve, reject) => {
			chrome.storage.local.get(['intention'], result => {
				globalStorage = result.intention
				resolve()
			})		
	})
}

// Extension kickoff
function startExtension() {
		addBar()
		addEventListeners()
		startP5()
}

// Extension teardown
function endExtension() {
	intention.remove()
}

// update dom with new browsing data
function intervalRefresh() {
	globalP5.redraw()
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	switch (request.control) {
		case 'startSession':
			startExtension()
			break
	}
})

// check if extension is active and kickoff
updateIntentionData().then(_ => {
	if(globalStorage.active = true) {
		startExtension()
	}
})