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