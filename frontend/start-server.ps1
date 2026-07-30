param(
  [int]$Port = 8080
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)

try {
  $listener.Start()
  Write-Host "Attendly is running at http://localhost:$Port/" -ForegroundColor Cyan
  Write-Host "Press Ctrl+C to stop the server."

  while ($true) {
    $client = $listener.AcceptTcpClient()
    $networkStream = $client.GetStream()
    $reader = [IO.StreamReader]::new($networkStream, [Text.Encoding]::ASCII, $false, 4096, $true)
    $requestLine = $reader.ReadLine()
    while ($reader.ReadLine() -ne '') { }
    $requestPath = ''
    if ($requestLine -match '^GET\s+([^\s?]+)') { $requestPath = [uri]::UnescapeDataString($Matches[1].TrimStart('/')) }
    if ([string]::IsNullOrWhiteSpace($requestPath)) { $requestPath = 'index.html' }
    $filePath = Join-Path $root $requestPath

    if (-not $filePath.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
      $bytes = [Text.Encoding]::UTF8.GetBytes('Not found')
      $header = [Text.Encoding]::ASCII.GetBytes("HTTP/1.1 404 Not Found`r`nContent-Type: text/plain; charset=utf-8`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`n`r`n")
      $networkStream.Write($header, 0, $header.Length)
      $networkStream.Write($bytes, 0, $bytes.Length)
      $client.Close()
      continue
    }

    $extension = [IO.Path]::GetExtension($filePath).ToLowerInvariant()
    $contentType = @{ '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css; charset=utf-8'; '.js' = 'application/javascript; charset=utf-8'; '.png' = 'image/png'; '.svg' = 'image/svg+xml' }[$extension]
    if (-not $contentType) { $contentType = 'application/octet-stream' }
    $bytes = [IO.File]::ReadAllBytes($filePath)
    $header = [Text.Encoding]::ASCII.GetBytes("HTTP/1.1 200 OK`r`nContent-Type: $contentType`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`n`r`n")
    $networkStream.Write($header, 0, $header.Length)
    $networkStream.Write($bytes, 0, $bytes.Length)
    $client.Close()
  }
} finally {
  $listener.Stop()
}
