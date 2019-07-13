// create references to html elements
var page = document.documentElement;
var body = document.getElementsByTagName('body')[0]

var intention = document.createElement('div')
intention.setAttribute("id", "intention")

var statement = document.createElement('span')
statement.setAttribute("id", "statement")

intention.append(statement)

// style core elements

body.style.paddingBottom = "65px"

intention.style.position = 'fixed';
intention.style.bottom = "0";
intention.style.width = '100%';
intention.style.height = '105px';
intention.style.backgroundColor = '#FFFFFF';
intention.style["z-index"] = "9999999999";

statement.style["font-size"] = "12px"

// global p5 object
var myp5

// get metadata from chrome extension storage
function getIntentionData() {
	return new Promise((resolve, reject) => {
			chrome.storage.local.get(['intention'], result => {
				resolve(result.intention)
			})		
	})
}

function startSession() {
	body.append(intention)

	getIntentionData().then(intentionData => {
		// intention statement
		statementText = intentionData.intention
		statementTextNode = document.createTextNode(statementText)
		statement.append(statementTextNode)

		var intentionNode = document.getElementById('intention')

		// intention chart
		var sketch = function(p5) {
			var intentionStart, width, height, tabSpacing

			p5.setup = function() {
				intentionStart = intentionData.start
				intentionEnd = intentionData.end
				width = window.innerWidth
				height = 50
				tabSpacing = height / intentionData.tabs.length

				var canvas = p5.createCanvas(width, height)
				canvas.parent(intentionNode)
				p5.noLoop()
			}

			p5.draw = function() {
				console.log('draw')
				getIntentionData().then(intentionData => {
					p5.background(255)
					var tabHeight, canvasHeight

					tabHeight = height / intentionData.tabs.length
					// TODO: Maybe grow the size of the canvas as more tabs are added?
					// if (intentionData.tabs.length < 5) {
					// tabHeight = height / intentionData.tabs.length
					// } else {
					// 	height = intentionData.tabs.length * 10
					// 	tabHeight = 10
						// p5.resizeCanvas(window.innerWidth, height);
					// }

					// Draw Sites
					p5.stroke(100)
					p5.strokeWeight(1)

					intentionData.tabs.forEach((tab, tabIndex) => {
						tab.history.forEach((site, siteIndex) => {

							// TODO: setting site.end saves it to storage for some reason? 
							let siteEndTime
							if (!site.end) {
								siteEndTime = Date.now()
							} else {
								siteEndTime = site.end
							}

							let siteHeight = tabHeight * 0.7
							let tabBuffer = tabHeight * 0.15

							// Draw Site Visit
							var x = p5.map(site.start, intentionStart, intentionEnd, 0, width)
							var y = 50 - (tabHeight * (tabIndex + 1)) + tabBuffer
							var w = p5.map(siteEndTime, intentionStart, intentionEnd, 0, width) - x
							var h = siteHeight

							p5.stroke('#cccccc')
							p5.fill('white')
							// console.log('tab:', tabIndex, 'site:', siteIndex, 'y:', y, 'x:', x, 'w:', w, 'h:', h)
							p5.rect(x, y, w, h, 20)


							// Draw Active Periods
							if (site.focusPeriods.length > 0) {
								site.focusPeriods.forEach((period, periodIndex) => {

									// TODO: setting site.end saves it to storage for some reason? 
									let periodEndTime
									if (!period.end) {
										periodEndTime = Date.now()
									} else {
										periodEndTime = period.end
									}

									let periodHeight = tabHeight * 0.7
									let periodBuffer = tabHeight * 0.15

									var x = p5.map(period.start, intentionStart, intentionEnd, 0, width)
									var y = 50 - (tabHeight * (tabIndex + 1)) + periodBuffer
									var w = p5.map(periodEndTime, intentionStart, intentionEnd, 0, width) - x
									var h = periodHeight

									// console.log('tab:', tabIndex, 'site:', siteIndex, 'period:', periodIndex, 'y:', y, 'x:', x, 'w:', w)
									p5.stroke('#A42020')
									p5.fill('#A42020')
									p5.rect(x, y, w, h, 20)

								})
							}
						})
					})

					intentionData.focusLost.forEach((period, periodIndex) => {

						let periodEndTime
						if(!period.end) {
							periodEndTime = Date.now()
						} else {
							periodEndTime = period.end
						}

						var x = p5.map(period.start, intentionStart, intentionEnd, 0, width)
						var y = 0
						var w = p5.map(periodEndTime, intentionStart, intentionEnd, 0, width) - x
						var h = 50

						// console.log('lost focus period:', periodIndex, 'w:', w, 'h:', h)
						p5.stroke('rgba(50,50,50, 0.75)')
						p5.fill('rgba(50,50,50, 0.75)')
						p5.rect(x, y, w, h)
					})
				})
			}

			p5.refreshData = function() {
				p5.redraw()
			}

		}

		myp5 = new p5(sketch);
	})

}

function endSession() {
	intention.remove()
}

// update dom with new browsing data
function updateContent() {
	myp5.refreshData()
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	switch (request.control) {
		case 'refreshData':
			updateContent()
			break
		case 'endSession':
			endSession()
			break
		case 'startSession':
			startSession()
			break
	}
})

startSession()