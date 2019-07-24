var reflectContainer = document.getElementById('reflect')
var startContainer = document.getElementById('start')
var endContainer = document.getElementById('end')


function checkState() {
	chrome.storage.local.get(['intention'], result => {

		if (result.intention.active) {
			reflectContainer.style.display = 'none'
			startContainer.style.display = 'none'
			endContainer.style.display = 'block'
		} else {
			startContainer.style.display = 'block'
			endContainer.style.display = 'none'
		}
	})	
}

function startSession(event){
	let intentionText = document.getElementById('intention-text').value
	let intentionTime = document.getElementById('intention-time').value

	chrome.runtime.sendMessage({control: 'startSession', text: intentionText, time: intentionTime}, response => {
			window.close()
	});
}

function endSession() {
	console.log('popup - end session')

	chrome.runtime.sendMessage({control: 'endSession'}, response => {
		console.log('end session')
	})
}


document.getElementById('start_session-button').addEventListener("click", startSession)
document.getElementById('end_session-button').addEventListener("click", endSession)

checkState()