param([Parameter(Mandatory=$true)][string]$ManifestPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$speechAssemblyPath = [System.Speech.Synthesis.SpeechSynthesizer].Assembly.Location
Add-Type -ReferencedAssemblies $speechAssemblyPath -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Speech.Synthesis;
using System.Speech.AudioFormat;
public class GuideSpeechMark {
    public int Position;
    public int Count;
    public double Seconds;
    public string Text;
}
public static class GuideSpeechRenderer {
    public static List<GuideSpeechMark> Render(string voice, string text, string file) {
        var marks = new List<GuideSpeechMark>();
        using (var synth = new SpeechSynthesizer()) {
            synth.SelectVoice(voice);
            synth.Rate = 0;
            synth.Volume = 100;
            synth.SpeakProgress += (sender, args) => {
                lock (marks) {
                    marks.Add(new GuideSpeechMark {
                        Position = args.CharacterPosition, Count = args.CharacterCount,
                        Seconds = args.AudioPosition.TotalSeconds, Text = args.Text
                    });
                }
            };
            synth.SetOutputToWaveFile(file, new SpeechAudioFormatInfo(16000, AudioBitsPerSample.Sixteen, AudioChannel.Mono));
            synth.Speak(text);
            synth.SetOutputToNull();
        }
        return marks;
    }
}
'@
$manifestAbsolute = [System.IO.Path]::GetFullPath($ManifestPath)
$guideRoot = [System.IO.Path]::GetDirectoryName($manifestAbsolute) + [System.IO.Path]::DirectorySeparatorChar
$manifest = Get-Content -LiteralPath $manifestAbsolute -Raw -Encoding UTF8 | ConvertFrom-Json
$count = 0
foreach ($phrase in $manifest.phrases) {
    $audioPath = [System.IO.Path]::GetFullPath($phrase.audio)
    $marksPath = [System.IO.Path]::GetFullPath($phrase.marks)
    foreach ($path in @($audioPath, $marksPath)) {
        if (-not $path.StartsWith($guideRoot, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Output outside guide directory' }
        if ([System.IO.File]::Exists($path)) { throw 'Preserve existing speech guide outputs' }
    }
    $marks = [GuideSpeechRenderer]::Render($manifest.voice, $phrase.text, $audioPath)
    $json = ConvertTo-Json -InputObject @($marks) -Depth 4
    [System.IO.File]::WriteAllText($marksPath, $json, (New-Object System.Text.UTF8Encoding($false)))
    $count++
}
Write-Output "Offline speech guide: $count original phrases"
