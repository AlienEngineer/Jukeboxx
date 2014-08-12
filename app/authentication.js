function getUrlParams () {
	var pageUrl = window.location.hash.substring(1);
	console.log(pageUrl);
	var urlVars = pageUrl.split('&');
	console.log(urlVars);
	var params = [];
	for (var i = 0; i < urlVars.length; i++) {
		var paramKV = urlVars[i].split('=');
		params.push(paramKV);
		console.log(paramKV[0] + ":" + paramKV[1] + ", ");
	}
	return params;
}

//https://dl.dropboxusercontent.com/spa/ygdhjrllquglhpk/Jukeboxx/public/authentication.html
//https://www.dropbox.com/1/oauth2/authorize?response_type=token&client_id=8f0dxv4um4zp3l4&redirect_uri=https://dl.dropboxusercontent.com/spa/ygdhjrllquglhpk/Jukeboxx/public/authentication.html

$(document).ready(function(){
	var params = getUrlParams();
	var success = (params.indexOf('error') == -1);
	if(success){
		$('#message').html("Authenticated. Redirecting now...");
	}else{
		$('#message').html(params['error_description']);
	}
});