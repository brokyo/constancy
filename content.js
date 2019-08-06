chrome.runtime.sendMessage({'control': 'activeWindowCheck'})

// only show intention bar if the window is the one the extension is runing on
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	if(request.control === 'isActiveWindow') {
		if(request.isActive) {
			updateIntentionData().then(_ => {
				startExtension()
			})					

		// create references to html elements
		var page = document.documentElement
		var body = document.getElementsByTagName('body')[0]

		var statement = document.createElement('span')
		statement.setAttribute("id", "statement")

		var canvasNode = document.createElement('div')
		canvasNode.setAttribute("id", "canvasNode")

		var intention = document.createElement('div')
		intention.setAttribute("id", "intention")
		intention.append(statement)
		intention.append(canvasNode)

		// Create hide button
		var hide = document.createElement('span')
		hide.setAttribute("id", "hide")
		hideText = '\u25BC'
		hideTextNode = document.createTextNode(hideText)
		hide.append(hideTextNode)
		intention.append(hide)

		var show = document.createElement('show')
		show.setAttribute("id", "show")
		showText = '\u25B2'
		showTextNode = document.createTextNode(showText)
		show.append(showTextNode)
		intention.append(show)



		// style core elements
		page.style.paddingBottom = "65px"

		intention.style.all = 'initial'
		intention.style["font-family"] = 'inherit'
		intention.style["font-weight"] = 'inherit'
		intention.style["font-size"] = 'inherit'
		intention.style.color = 'inherit'
		intention.style.position = 'fixed'
		intention.style.bottom = "0"
		intention.style.left = "0"
		intention.style.width = '100%'
		intention.style.padding = '0'
		intention.style.margin = '0'
		intention.style.borderRadius = '0'
		intention.style.backgroundColor = '#FFFFFF'
		intention.style["z-index"] = "9999999999"
		intention.style["text-align"] = "center"
		intention.style.webkitBoxShadow = '0 0 1px rgba(0,0,0,0.4)'

		statement.style["font-size"] = "16px"
		statement.style["font-family"] = "inherit"
		statement.style.display = "block"
		statement.style.padding = "5px 0px"

		hide.style.display = "block"
		hide.style.position = "absolute"
		hide.style.top = "4px"
		hide.style.right = "6px"
		hide.style["font-size"] = "10px"
		hide.style["font-weight"] = "900"
		hide.style.cursor = "pointer"

		show.style.display = 'none'
		show.style.position = "absolute"
		show.style.top = "4px"
		show.style.right = "6px"
		show.style["font-size"] = "10px"
		show.style["font-weight"] = "900"
		show.style.cursor = "pointer"

		canvasNode.style.all = 'unset'

		// global p5 object | allows other methods to run p5 operations
		var globalP5, globalStorage

		// Attach bar to DOM
		function addBar() {
			updateIntentionData().then(_ => {
				// Don't show the bar in
				// if(globalStorage.windowId !== ) {return}

				statementText = globalStorage.intention
				statementTextNode = document.createTextNode('I intend to ' + statementText)
				statement.append(statementTextNode)

				// Handle DOM stuff
				body.append(intention)
				document.getElementById('hide').addEventListener("click", hideChart)
				document.getElementById('show').addEventListener("click", showChart)
			})
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

		// P5 kickoff
		function startP5() {

			var sketch = function(p5) {

				p5.setup = function() {
					var canvas = p5.createCanvas(window.innerWidth, globalStorage.tabs.length * 10)
					canvas.parent(canvasNode)
					
					p5.noLoop()
				}

				p5.draw = function() {
					p5.background(255)

					// shared Values
					var tabHeight = 10
					var intentionStart = globalStorage.start
					var intentionEnd = globalStorage.end
					var canvasHeight = globalStorage.tabs.length * tabHeight
					var canvasWidth = window.innerWidth
					var canvasBuffer = 10
					var siteHeight = tabHeight * 0.7
					var tabBuffer = tabHeight * 0.15


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

							var x = p5.map(site.start, intentionStart, intentionEnd, canvasBuffer, canvasWidth - canvasBuffer)
							var y = canvasHeight - (tabHeight * (tabIndex + 1)) + tabBuffer
							var w = p5.map(siteEndTime, intentionStart, intentionEnd, canvasBuffer, canvasWidth - canvasBuffer) - x
							var h = siteHeight

							p5.stroke('#3227A5')
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

									var x = p5.map(period.start, intentionStart, intentionEnd, canvasBuffer, canvasWidth - canvasBuffer)
									var y = canvasHeight - (tabHeight * (tabIndex + 1)) + periodBuffer
									var w = p5.map(periodEndTime, intentionStart, intentionEnd, canvasBuffer, canvasWidth - canvasBuffer) - x
									var h = periodHeight

									// console.log('tab:', tabIndex, 'site:', siteIndex, 'period:', periodIndex, 'y:', y, 'x:', x, 'w:', w)
									p5.fill('#BDB8EC')
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

						var x = p5.map(period.start, intentionStart, intentionEnd, canvasBuffer, canvasWidth - canvasBuffer)
						var y = 0
						var w = p5.map(periodEndTime, intentionStart, intentionEnd, canvasBuffer, canvasWidth - canvasBuffer) - x
						var h = canvasHeight

						// console.log('lost focus period:', periodIndex, 'w:', w, 'h:', h)
						let focusColor = 'rgba(150, 150, 150, 0.4)' 
						p5.stroke(focusColor)
						p5.fill(focusColor)
						p5.rect(x, y, w, h)
					})
				}

				p5.windowResized = function() {
					let tabHeight = 10
					p5.resizeCanvas(window.innerWidth, globalStorage.tabs.length * tabHeight)
				}
			}

			globalP5 = new p5(sketch)
		}

		function updateP5() {
			// Have to call windowResized() to deal with new tabs
			globalP5.windowResized()
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
				// TODO: this is a horrible way to deal with a race condition. Maybe have a callback on the global data load
				// TODO: honestly should look at that whole localStorage system again :/
				setTimeout(_ => {
					startP5()
				}, 100)
		}

		// Extension teardown
		function endExtension() {
			intention.remove()
		}

		// update dom with new browsing data
		function intervalRefresh() {
			globalP5.redraw()
		}

		function hideChart() {
			canvasNode.style.display = 'none'
			hide.style.display = 'none'
			show.style.display = 'block'
		}

		function showChart() {
			canvasNode.style.display = 'block'
			hide.style.display = 'block'
			show.style.display = 'none'
		}

		chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
			switch (request.control) {
				case 'startSession':
					startExtension()
					break
			}
		})


		}
	}
});