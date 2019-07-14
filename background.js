// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	////////////////////
	// Start Session
	//
	// after receiving startSession message create base data model and setup listeners
	////////////////////
	if (request.control === 'startSession') {
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
		chrome.tabs.query({currentWindow: true}, tabs => {
			intentionData.windowId = tabs[0].windowId

			tabs.forEach(tab => {
				// activate content.js in relevant tabs
				chrome.tabs.sendMessage(tab.id, {control: "startSession"}, function(response) {})

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
			intentionData.tabs[0].history[0].focusPeriods.push({start: Date.now(), end: undefined})

			updateIntentionData(intentionData).then(response => {})
		})
	}

	// End Session	
	if (request.control === 'endSession') {
		console.log('background - end session')

		chrome.tabs.query({}, function(tabs){
			tabs.forEach(tab => {
				console.log('end session on tab', tab.id)
				chrome.tabs.sendMessage(tab.id, {control: "endSession"}, function(response) {})
			})  
		});
	}
});

//////////////////
// Page Change
//
// after a page change is complete end previous page session and create a new one
//////////////////
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	// when tab update completes the page is not the newtab placeholder
	if (tab.status === 'complete' && tab.url !== "chrome://*") {
		getIntentionData().then(intentionData => {
			// get the relevant tab
			let tabIndex = intentionData.tabs.findIndex(savedTab => savedTab.currentId === tab.id)

			// end the previous focus session
			let previousPageIndex = intentionData.tabs[tabIndex].history.length - 1
			if (previousPageIndex > -1) {
				intentionData.tabs[tabIndex].history[previousPageIndex].end = Date.now()
				let previousSessionIndex = intentionData.tabs[tabIndex].history[previousPageIndex].focusPeriods.length - 1
				intentionData.tabs[tabIndex].history[previousPageIndex].focusPeriods[previousSessionIndex].end = Date.now()				
			}

			// create an object for the new page
			let webpage = {
				title: tab.title,
				url: tab.url,
				start: Date.now(),
				end: undefined,
				focusPeriods: []
			}

			// begin a focus period on it
			webpage.focusPeriods.push({start: Date.now(), end: undefined})
			intentionData.tabs[tabIndex].history.push(webpage)

			updateIntentionData(intentionData)
		})
	}
})


//////////////
// New Tab
//
// when a new tab is created assoicate it with existing tab container or create a new one
//////////////
chrome.tabs.onCreated.addListener(tab => {
		getIntentionData().then(intentionData => {
			if(tab.windowId !== intentionData.windowId){return}

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

	 			if (tab.url !== "chrome://newtab/") {
					// create page object and push it to containers history
					let webpage = {
						title: tab.title,
						url: tab.url,
						start: Date.now(),
						end: undefined,
						focusPeriods: []
					}
					newTab.history.push(webpage)
				} 

				intentionData.tabs.push(newTab)
			}

			updateIntentionData(intentionData)
		})
})

/////////////////
// Change Tab 
//
// on tab change event end the previous active period and begin a new one
////////////////
// TODO: This is a nutso approach to manipulating data
chrome.tabs.onActivated.addListener(newFocusTab => {
	// get information about the new active tab
	chrome.tabs.get(newFocusTab.tabId, tab => {
		// TODO: setting timeout as a garbage hack to deal with race condition
		// data write at the end of onCreated does not complete before data read in onActivated meaning old data gets overwritten  
		setTimeout(function() {
			getIntentionData().then(intention =>{
				// set the old tab as inactive
				let previousTabIndex = intention.tabs.findIndex(tab => tab.focus === true)
				// assuming there is a previous active tab
				if (previousTabIndex > -1) {
					intention.tabs[previousTabIndex].focus = false

					// and end previous active period
					let previousFocusPageIndex = intention.tabs[previousTabIndex].history.length - 1
					if(previousFocusPageIndex > -1) {
						let previousFocusPeriodIndex = intention.tabs[previousTabIndex].history[previousFocusPageIndex].focusPeriods.length - 1
						intention.tabs[previousTabIndex].history[previousFocusPageIndex].focusPeriods[previousFocusPeriodIndex].end = Date.now()
					}
				}

				// set new tab as active
				let focusTabIndex = intention.tabs.findIndex(tab => tab.currentId === newFocusTab.tabId)
				intention.tabs[focusTabIndex].focus = true

				// and start new active session
				let focusPageIndex = intention.tabs[focusTabIndex].history.length - 1
				if (focusPageIndex > -1) {
					intention.tabs[focusTabIndex].history[focusPageIndex].focusPeriods.push({start: Date.now(), end: undefined})
				}

				updateIntentionData(intention).then(response => {
				})
			})
		}, 50)
	})
})

//////////////////
// Close Tab
//
// on tab close set associated tab container as inactive
//////////////////
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {

	getIntentionData().then(intentionData => {
		if (removeInfo.windowId === intentionData.windowId) {
			let removedTabIndex = intentionData.tabs.findIndex(tab => tab.currentId === tabId)
			let lastPageIndex = intentionData.tabs[removedTabIndex].history.length - 1
			intentionData.tabs[removedTabIndex].history[lastPageIndex].end = Date.now()
			intentionData.tabs[removedTabIndex].available = true
		}

		updateIntentionData(intentionData).then(response => {

		})

	})
})

//////////////////
// Focus Lost
//
// track when user leaves window entirely
//////////////////
chrome.windows.onFocusChanged.addListener(windowId => {
	getIntentionData().then(intentionData => {
		if (intentionData.focus && windowId !== intentionData.windowId) {
			intentionData.focus = false
			intentionData.focusLost.push({start: Date.now(), end: undefined})
		} else if (!intentionData.focus && windowId === intentionData.windowId) {
			let focusIndex = intentionData.focusLost.length - 1
			intentionData.focus = true
			intentionData.focusLost[focusIndex].end = Date.now()
		}	

		updateIntentionData(intentionData)
	})
})

///////////////////
// Data Updated
//
// update active content display when underlying data changes
///////////////////
chrome.storage.onChanged.addListener((changes, area) => {
	let newData = changes.intention.newValue

	chrome.tabs.query({active: true}, function(tabs){
		tabs.forEach(tab => {
			let activeWindow = newData.windowId
			if(tab.windowId === activeWindow) {
				console.log(newData)
				chrome.tabs.sendMessage(tab.id, {control: "updateData", data: newData}, response => {})				
			}
		})
	})
})

// HELPER METHODS //
function refreshData() {
	chrome.tabs.query({}, function(tabs){
		tabs.forEach(tab => {
			chrome.tabs.sendMessage(tab.id, {control: "refreshData"}, function(response) {})
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

function updateIntentionData(intentionData) {
	return new Promise((resolve, reject) => {
		chrome.storage.local.set({'intention': intentionData}, _ => {
			// console.log('set:', intentionData)
			chrome.storage.local.get(['intention'], data => {
				resolve(data.intention)
			})
		})
	})
}

// Refresh the browsing data every minute
chrome.alarms.create('refreshBrowsingData', {when: Date.now() + 1000, periodInMinutes: 1})
chrome.alarms.onAlarm.addListener(_ => {
	refreshData()
})
