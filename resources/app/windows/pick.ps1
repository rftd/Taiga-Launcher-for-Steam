param([string]$Kind)
Add-Type -AssemblyName System.Windows.Forms
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
if($Kind -eq 'folder' -or $Kind -eq 'steam' -or $Kind -eq 'scripts') {
 $d = New-Object System.Windows.Forms.FolderBrowserDialog
 $d.Description = 'Selecione a pasta'
 if($d.ShowDialog() -eq 'OK'){ ConvertTo-Json -InputObject @($d.SelectedPath) -Compress } else {'[]'}
} else {
 $d = New-Object System.Windows.Forms.OpenFileDialog
 $d.DereferenceLinks = $false
 if($Kind -eq 'game'){$d.Filter='Jogos|*.exe;*.iso;*.cso;*.pbp;*.chd;*.cue;*.bin;*.m3u;*.gcm;*.rvz;*.wbfs;*.ciso;*.nes;*.sfc;*.smc;*.gb;*.gbc;*.gba;*.nds;*.3ds;*.z64;*.n64;*.v64;*.gen;*.md;*.sms;*.gg;*.xci;*.nsp;*.nsz;*.xcz;*.wud;*.wux;*.wua;*.rpx;*.xex;*.xiso;*.cci;*.cia;*.cxi;*.3dsx;*.gdi;*.cdi;*.zip;*.7z;*.pce;*.a26;*.a78;*.lnx;*.ws;*.wsc;*.ngp;*.ngc;*.smd;*.32x;*.sg;*.dsk;*.vpk;*.rom;*.lnk;*.url';$d.Multiselect=$true}
 elseif($Kind -eq 'art'){$d.Filter='Artes (*.png;*.jpg;*.jpeg;*.ico)|*.png;*.jpg;*.jpeg;*.ico'}
 elseif($Kind -eq 'core'){$d.Filter='Núcleo (*.dll)|*.dll'}
 else {$d.Filter='Executável (*.exe)|*.exe'}
 if($d.ShowDialog() -eq 'OK'){ ConvertTo-Json -InputObject @($d.FileNames) -Compress } else {'[]'}
}
