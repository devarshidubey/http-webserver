"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HTTPError = void 0;
exports.generateHTTPErrorPage = generateHTTPErrorPage;
class HTTPError extends Error {
    constructor(code, reason, message) {
        super(message);
        this.name = "HTTPError";
        this.code = code;
        this.reason = reason;
    }
}
exports.HTTPError = HTTPError;
function generateHTTPErrorPage(errorCode, reason, message) {
    const code = errorCode.toString();
    const htmlPage = `
		<!DOCTYPE html>
		<html lang="en">

		<head>
		  <meta charset="utf-8" />
		  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
		  <meta name="viewport" content="width=device-width, initial-scale=1" />

		  <title>Error</title>

		  <!-- Google Fonts -->
		  <link href="https://fonts.googleapis.com/css?family=Cabin:400,700" rel="stylesheet">
		  <link href="https://fonts.googleapis.com/css?family=Montserrat:900" rel="stylesheet">

		  <!-- Embedded CSS -->
		  <style>
			* {
			  -webkit-box-sizing: border-box;
			  box-sizing: border-box;
			}

			body {
			  padding: 0;
			  margin: 0;
			}

			#notfound {
			  position: relative;
			  height: 100vh;
			}

			#notfound .notfound {
			  position: absolute;
			  left: 50%;
			  top: 50%;
			  -webkit-transform: translate(-50%, -50%);
			  -ms-transform: translate(-50%, -50%);
			  transform: translate(-50%, -50%);
			}

			.notfound {
			  max-width: 520px;
			  width: 100%;
			  line-height: 1.4;
			  text-align: center;
			}

			.notfound .notfound-404 {
			  position: relative;
			  height: 240px;
			}

			.notfound .notfound-404 h1 {
			  font-family: 'Montserrat', sans-serif;
			  position: absolute;
			  left: 50%;
			  top: 50%;
			  -webkit-transform: translate(-50%, -50%);
			  -ms-transform: translate(-50%, -50%);
			  transform: translate(-50%, -50%);
			  font-size: 252px;
			  font-weight: 900;
			  margin: 0px;
			  color: #262626;
			  text-transform: uppercase;
			  letter-spacing: -40px;
			  margin-left: -20px;
			}

			.notfound .notfound-404 h1>span {
			  text-shadow: -8px 0px 0px #fff;
			}

			.notfound .notfound-404 h3 {
			  font-family: 'Cabin', sans-serif;
			  position: relative;
			  font-size: 16px;
			  font-weight: 700;
			  text-transform: uppercase;
			  color: #262626;
			  margin: 0px;
			  letter-spacing: 3px;
			  padding-left: 6px;
			}

			.notfound h2 {
			  font-family: 'Cabin', sans-serif;
			  font-size: 20px;
			  font-weight: 400;
			  text-transform: uppercase;
			  color: #000;
			  margin-top: 0px;
			  margin-bottom: 25px;
			}

			@media only screen and (max-width: 767px) {
			  .notfound .notfound-404 {
				height: 200px;
			  }

			  .notfound .notfound-404 h1 {
				font-size: 200px;
			  }
			}

			@media only screen and (max-width: 480px) {
			  .notfound .notfound-404 {
				height: 162px;
			  }

			  .notfound .notfound-404 h1 {
				font-size: 162px;
				height: 150px;
				line-height: 162px;
			  }

			  .notfound h2 {
				font-size: 16px;
			  }
			}
		  </style>

		  <meta name="robots" content="noindex, follow">
		</head>

		<body>
		  <div id="notfound">
			<div class="notfound">
			  <div class="notfound-404">
				<h3>Oops! ${reason}</h3>
				<h1><span>${code[0]}</span><span>${code[1]}</span><span>${code[2]}</span></h1>
			  </div>
			  <h2>${message}</h2>
			</div>
		  </div>

		  <!-- Optional Google Analytics (can remove if not needed) -->
		  <script async src="https://www.googletagmanager.com/gtag/js?id=UA-23581568-13"></script>
		  <script>
			window.dataLayer = window.dataLayer || [];
			function gtag() { dataLayer.push(arguments); }
			gtag('js', new Date());
			gtag('config', 'UA-23581568-13');
		  </script>
		</body>

		</html>

	
	`;
    return Buffer.from(htmlPage, 'utf-8');
}
