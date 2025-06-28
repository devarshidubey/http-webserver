`<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to My Portfolio</title>

  <!-- Google Fonts -->
  <link href="https://fonts.googleapis.com/css?family=Cabin:400,700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css?family=Montserrat:900&display=swap" rel="stylesheet">

  <style>
    * {
      -webkit-box-sizing: border-box;
      box-sizing: border-box;
    }

    body {
      padding: 0;
      margin: 0;
      font-family: 'Cabin', sans-serif;
      background-color: #f9f9f9;
    }

    #homepage {
      position: relative;
      height: 100vh;
    }

    #homepage .content {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      max-width: 600px;
      width: 100%;
      text-align: center;
      line-height: 1.5;
    }

    .title {
      font-family: 'Montserrat', sans-serif;
      font-size: 72px;
      font-weight: 900;
      text-transform: uppercase;
      color: #262626;
      letter-spacing: -2px;
      margin: 0 0 10px 0;
    }

    .subtitle {
      font-size: 20px;
      font-weight: 700;
      text-transform: uppercase;
      color: #555;
      margin: 0 0 25px 0;
      letter-spacing: 2px;
    }

    .description {
      font-size: 16px;
      color: #333;
      margin-bottom: 30px;
    }

    .nav-buttons a {
      display: inline-block;
      margin: 0 10px;
      padding: 12px 24px;
      background-color: #262626;
      color: #fff;
      text-decoration: none;
      font-weight: bold;
      text-transform: uppercase;
      border-radius: 4px;
      letter-spacing: 1px;
      transition: background-color 0.3s;
    }

    .nav-buttons a:hover {
      background-color: #444;
    }

    @media only screen and (max-width: 480px) {
      .title {
        font-size: 48px;
      }

      .subtitle {
        font-size: 16px;
      }

      .description {
        font-size: 14px;
      }

      .nav-buttons a {
        padding: 10px 20px;
        font-size: 14px;
      }
    }
  </style>
</head>

<body>
  <div id="homepage">
    <div class="content">
      <h1 class="title">Welcome</h1>
      <h2 class="subtitle">To My Portfolio</h2>
      <p class="description">
        I'm a creative developer passionate about building beautiful, functional web experiences.<br />
        Explore my work and get in touch!
      </p>
      <div class="nav-buttons">
        <a href="#projects">Projects</a>
        <a href="#contact">Contact</a>
        <a href="#about">About Me</a>
      </div>
    </div>
  </div>
</body>

</html>
`
