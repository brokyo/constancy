function attachListeners() {
	chrome.tabs.onUpdated.addListener(pageUpdated)
	chrome.tabs.onCreated.addListener(newTab)
	chrome.tabs.onActivated.addListener(tabChange)
	chrome.tabs.onRemoved.addListener(closeTab)
	chrome.windows.onFocusChanged.addListener(focusChange)
	chrome.storage.onChanged.addListener(dataUpdated)
}

function removeListeners() {
	chrome.tabs.onUpdated.removeListener(pageUpdated)	
	chrome.tabs.onCreated.removeListener(newTab)
	chrome.tabs.onActivated.removeListener(tabChange)
	chrome.tabs.onRemoved.removeListener(closeTab)
	chrome.windows.onFocusChanged.removeListener(focusChange)
	chrome.storage.onChanged.removeListener(dataUpdated)
}

// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	////////////////////
	// Start Session
	//
	// after receiving startSession message create base data model and setup listeners
	////////////////////
	if (request.control === 'startSession') {
		attachListeners()
		// session tracking object
		let intentionData = {
			active: true,
			focus: true,
			windowId: window.id,
			intention: request.text,
			time: request.time,
			start: Date.now(),
			end: Date.now() + request.time * 60 * 1000,
			success: false,
			tabs: [],
			focusLost: []
		}

		// Get all tabs in active window
		chrome.tabs.query({
			currentWindow: true
		}, tabs => {
			intentionData.windowId = tabs[0].windowId

			tabs.forEach(tab => {
				// activate content.js in relevant tabs
				chrome.tabs.sendMessage(tab.id, {
					control: "startSession"
				}, async response => {})

				let newTab = {
					available: false,
					focus: false,
					currentId: tab.id,
					history: []
				}

				let webpage = {
					title: tab.title,
					url: tab.url,
					start: Date.now(),
					end: undefined,
					focusPeriods: []
				}

				newTab.history.push(webpage)

				intentionData.tabs.push(newTab)
			})

			// Set the current window as active
			intentionData.tabs[0].focus = true
			intentionData.tabs[0].history[0].focusPeriods.push({
				start: Date.now(),
				end: undefined
			})

			updateIntentionData('startSession', intentionData).then(response => {})
		})

		// Set ending alarm
		createEndAlarm(intentionData.end)
	}

	// End Session	
	if (request.control === 'endSession') {
		endSession()
		// chrome.tabs.query({}, function(tabs) {
		// 	tabs.forEach(tab => {
		// 		console.log('end session on tab', tab.id)
		// 		chrome.tabs.sendMessage(tab.id, {
		// 			control: "endSession"
		// 		}, async response => {})
		// 	})
		// });
	}
});

//////////////////
// Page Change
//
// after a page change is complete end previous page session and create a new one
//////////////////
function pageUpdated(tabId, changeInfo, tab) {
	if (tab.status === 'complete') {
		if(tab.url === 'chrome://newtab/') { return }

		getIntentionData().then(intentionData => {

			// Ignore if it's not in an active window
			if (tab.windowId !== intentionData.windowId) {return}

			// get the indicies of the relevant tab and 
			let tabIndex = intentionData.tabs.findIndex(savedTab => savedTab.currentId === tab.id)
			let previousPageIndex = intentionData.tabs[tabIndex].history.length - 1

			// check that there is a previous page
			let previousPageExists = previousPageIndex > -1 ? true : false
			if (previousPageExists && !intentionData.tabs[tabIndex].history[previousPageIndex].end) {
				// make sure that the page's url isn't the same [infinite scroll, refreshes, ads]
				if (intentionData.tabs[tabIndex].history[previousPageIndex].url === tab.url) {return}

				// end the previous focus session
				intentionData.tabs[tabIndex].history[previousPageIndex].end = Date.now()
				let previousSessionIndex = intentionData.tabs[tabIndex].history[previousPageIndex].focusPeriods.length - 1
				intentionData.tabs[tabIndex].history[previousPageIndex].focusPeriods[previousSessionIndex].end = Date.now()
			}

			// create an object for the new page
			let webpage = createWebPageObject(tab)

			// begin a focus period on it
			webpage.focusPeriods.push({
				start: Date.now(),
				end: undefined
			})
			intentionData.tabs[tabIndex].history.push(webpage)

			updateIntentionData('pageUpdated', intentionData)
		})
	}
}

//////////////
// New Tab
//
// when a new tab is created assoicate it with existing tab container or create a new one
//////////////
function newTab(tab) {
	getIntentionData().then(intentionData => {
		if (tab.windowId !== intentionData.windowId) {
			return
		}

		let tabContainer

		// Get the first inactive tab
		var availableTabIndex = intentionData.tabs.findIndex(tab => tab.available === true)

		// if there's an inactive container update it with new metadata 
		if (availableTabIndex > -1) {
			tabContainer = intentionData.tabs[availableTabIndex]
			tabContainer.available = false
			tabContainer.currentId = tab.id

			// if all tab containers are in use create a new one
		} else {
			// Create new tab object
			let newTab = {
				available: false,
				focus: false,
				currentId: tab.id,
				history: []
			}

			intentionData.tabs.push(newTab)
			availableTabIndex = intentionData.tabs.length - 1
		}

		// create page object and push it to container's history
		let webpage = {
			end: undefined,
			focusPeriods: [],
			start: Date.now(),
			title: tab.title,
			url: tab.url,
		}

		intentionData.tabs[availableTabIndex].history.push(webpage)


		updateIntentionData('newTab', intentionData)
	})
}

/////////////////
// Change Tab 
//
// on tab change event end the previous active period and begin a new one
////////////////
// TODO: Need to revisit this whole thing. Bunch of hacks stacked on top of one another
function tabChange(newFocusTab) {

	// get information about the new active tab. Use timeout because of a race condition?
	setTimeout(function() {
		getIntentionData().then(intentionData => {
			if (newFocusTab.windowId !== intentionData.windowId) {
				return
			}

			chrome.tabs.get(newFocusTab.tabId, tab => {
				// set the old tab as inactive
				let previousTabIndex = intentionData.tabs.findIndex(tab => tab.focus === true)
				// assuming there is a previous active tab
				if (previousTabIndex > -1) {
					intentionData.tabs[previousTabIndex].focus = false

					// and end previous active period
					let previousFocusPageIndex = intentionData.tabs[previousTabIndex].history.length - 1
					if (previousFocusPageIndex > -1) {
						let previousFocusPeriodIndex = intentionData.tabs[previousTabIndex].history[previousFocusPageIndex].focusPeriods.length - 1
						intentionData.tabs[previousTabIndex].history[previousFocusPageIndex].focusPeriods[previousFocusPeriodIndex].end = Date.now()
					}
				}

				// set new tab as active
				let focusTabIndex = intentionData.tabs.findIndex(tab => tab.currentId === newFocusTab.tabId)
				intentionData.tabs[focusTabIndex].focus = true

				// and start new active session
				let focusPageIndex = intentionData.tabs[focusTabIndex].history.length - 1
				if (focusPageIndex > -1) {
					intentionData.tabs[focusTabIndex].history[focusPageIndex].focusPeriods.push({
						start: Date.now(),
						end: undefined
					})
				}

				updateIntentionData('tabChange', intentionData).then(response => {})
			})
		})
	}, 50)
}


//////////////////
// Close Tab
//
// on tab close set associated tab container as inactive
//////////////////
function closeTab(tabId, removeInfo) {
	getIntentionData().then(intentionData => {
		// ensure the tab was closed in this window with the extension
		if (removeInfo.windowId === intentionData.windowId) {
			let removedTabIndex = intentionData.tabs.findIndex(tab => tab.currentId === tabId)
			let lastPageIndex = intentionData.tabs[removedTabIndex].history.length - 1
			let lastFocusIndex = intentionData.tabs[removedTabIndex].history[lastPageIndex].focusPeriods.length - 1

			intentionData.tabs[removedTabIndex].history[lastPageIndex].end = Date.now()

			if(!intentionData.tabs[removedTabIndex].history[lastPageIndex].focusPeriods[lastFocusIndex].end) {
				intentionData.tabs[removedTabIndex].history[lastPageIndex].focusPeriods[lastFocusIndex].end = Date.now()
			}
			intentionData.tabs[removedTabIndex].available = true

			updateIntentionData('closeTab', intentionData).then(response => {

			})

		}
	})
}


//////////////////
// Focus Lost
//
// track when user leaves window entirely
//////////////////
function focusChange(windowId) {
		getIntentionData().then(intentionData => {
		if (intentionData.focus && windowId !== intentionData.windowId) {
			intentionData.focus = false
			intentionData.focusLost.push({
				start: Date.now(),
				end: undefined
			})
		} else if (!intentionData.focus && windowId === intentionData.windowId) {
			let focusIndex = intentionData.focusLost.length - 1
			intentionData.focus = true
			intentionData.focusLost[focusIndex].end = Date.now()
		}

		updateIntentionData('focusChange', intentionData)
	})
}


///////////////////
// Data Updated
//
// update active content display when underlying data changes
///////////////////
function dataUpdated(changes, area) {
	let newData = changes.intention.newValue

	chrome.tabs.query({
		active: true
	}, function(tabs) {
		tabs.forEach(tab => {
			let activeWindow = newData.windowId
			if (tab.windowId === activeWindow) {
				chrome.tabs.sendMessage(tab.id, {
					control: "updateData",
					data: newData
				}, async response => {})
			}
		})
	})
}


// HELPER METHODS //
function createWebPageObject(tab) {
	return {
		title: tab.title,
		url: tab.url,
		start: Date.now(),
		end: undefined,
		focusPeriods: []
	}
}

function intervalRefresh(activeWindow) {
	chrome.tabs.query({
		active: true
	}, function(tabs) {
		tabs.forEach(tab => {
			if (tab.windowId === activeWindow) {
				chrome.tabs.sendMessage(tab.id, {
					control: "intervalRefresh"
				}, async response => {})
			}
		})
	});
}

function getIntentionData() {
	return new Promise((resolve, reject) => {
		chrome.storage.local.get(['intention'], result => {
			resolve(result.intention)
		})
	})
}

function updateIntentionData(method, intentionData) {
	return new Promise((resolve, reject) => {
		chrome.storage.local.set({
			'intention': intentionData
		}, _ => {
			console.log(method, 'set:', intentionData.tabs)
			chrome.storage.local.get(['intention'], data => {
				resolve(data.intention)
			})
		})
	})
}

function createEndAlarm(endTime) {
	chrome.alarms.create('endSession', {
		when: endTime
	})
}

function endSession() {
	getIntentionData().then(data => {
		data.active = false
		updateIntentionData('endSession', data)

		chrome.tabs.query({}, tabs => {
			tabs.forEach(tab => {
				if(tab.windowId === data.windowId) {
					chrome.tabs.sendMessage(tab.id, {
						control: "endSession"
					}, async response => {})			
				}
			})
		})
	})
}

// Refresh the browsing data every minute
chrome.alarms.create('refreshBrowsingData', {
	when: Date.now() + 1000,
	periodInMinutes: 1
})

chrome.alarms.onAlarm.addListener(alarm => {
	switch (alarm.name) {
		case 'refreshBrowsingData':
		getIntentionData().then(data => {
			let activeWindow = data.windowId
			intervalRefresh(activeWindow)
		})
		break

		case 'endSession':
		endSession()
		break
	}

})