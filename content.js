// create core html elements
var page = document.documentElement;
var body = document.getElementsByTagName('body')[0]

var intention = document.createElement('div')
intention.setAttribute("id", "intention")
body.append(intention)

var statement = document.createElement('span')
statement.setAttribute("id", "statement")
intention.append(statement)



// css styling
page.style["padding-bottom"] = "100px !important"

intention.style.position = 'fixed';
intention.style.bottom = "0";
intention.style.width = '100%';
intention.style.height = '200px';
intention.style.backgroundColor = '#FFFFFF';
intention.style["z-index"] = "9999999999";

statement.style["font-size"] = "12px"

// update dom with new browsing data
function updateContent() {
	// get metadata from chrome extension storage
	var getIntentionData = new Promise(function(resolve, reject) {
		chrome.storage.local.get('intention', function(result) {
			resolve(result.intention)
		});
	})

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
		  	console.log('p5 redraw')

				// Draw Sites
				p5.stroke(0)
				p5.strokeWeight(2)
				p5.fill('white')

				var tabHeight = height / intentionData.tabs.length
				for (let i = 0; i < intentionData.tabs.length; i++) {
					let tab = intentionData.tabs[i]

					for (let j = 0; j < intentionData.tabs[i].sitesVisited.length; j++) {
						let site = intentionData.tabs[i].sitesVisited[j]
						var x = p5.map(site.start, intentionStart, intentionEnd, 0, width)
						var y = tabHeight * j
						var w = p5.map(Date.now(), intentionStart, intentionEnd, 0, width)
						var h = tabHeight

						p5.rect(x, y, w, h)
					}
				}
		  }

		}

		var myp5 = new p5(sketch);
	})
}

updateContent()

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	console.log(request)

	if ( request.control === "refreshData" ){
		updateContent()
	}
})