// create references to html elements
var page = document.documentElement;
var body = document.getElementsByTagName('body')[0]

var intention = document.createElement('div')
intention.setAttribute("id", "intention")

var statement = document.createElement('span')
statement.setAttribute("id", "statement")

intention.append(statement)

// style core elements
page.style["padding-bottom"] = "100px !important"

intention.style.position = 'fixed';
intention.style.bottom = "0";
intention.style.width = '100%';
intention.style.height = '200px';
intention.style.backgroundColor = '#FFFFFF';
intention.style["z-index"] = "9999999999";

statement.style["font-size"] = "12px"

// global p5 object
var myp5

// get metadata from chrome extension storage
var getIntentionData = new Promise(function(resolve, reject) {
	chrome.storage.local.get('intention', function(result) {
		resolve(result.intention)
	});
})


function startSession() {
	body.append(intention)

	getIntentionData.then(intentionData => {
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
					height = 200
					tabSpacing = height / intentionData.tabs.length

					var canvas = p5.createCanvas(width, height)
					canvas.parent(intentionNode)
					p5.background(0)
					p5.noLoop()
			  }

			  p5.draw = function() {
			  	p5.background(0)
			  	console.log('p5 redraw')

				var tabHeight, canvasHeight

				if(tabs.length < 5){
					height = 50
					tabHeight = height / intentionData.tabs.length
				} else {
					height = tabs.length * 10
					tabHeight = 10
				}


				// Draw Sites
				p5.stroke(100)
				p5.strokeWeight(1)

				intentionData.tabs.forEach(tab => {
					tab.sitesVisited.forEach((site, siteIndex) => {
						if(!site.end) site.end = Date.now()
						// Draw Site Visit
						var x = p5.map(site.start, intentionStart, intentionEnd, 0, width)
						var y = tabHeight * siteIndex
						var w = p5.map(site.end, intentionStart, intentionEnd, 0, width)
						var h = tabHeight
	

						p5.fill('white')
						p5.rect(x, y, w, h)

						// Draw Active Periods
						if (site.activePeriods) {
							site.activePeriods.forEach((period, periodIndex) => {
								if(!period.end) period.end = Date.now()
								var x = p5.map(period.start, intentionStart, intentionEnd, 0, width)
								var y = tabHeight * periodIndex
								var w = p5.map(period.end, intentionStart, intentionEnd, 0, width)
								var h = tabHeight

								p5.fill('black')
								p5.rect(x, y, w, h)

							})
						}

					})
				})


			  p5.refreshData = function() {
			  	p5.redraw()
			  }

			}

		myp5 = new p5(sketch);
	}
	})
}

function endSession() {
	intention.remove()
}


var myp5

// update dom with new browsing data
function updateContent() {
	console.log('update content')
	myp5.refreshData()
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	console.log(request)

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