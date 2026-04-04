<?php
$dir = "C:\\Users\\HOME\\Pictures\\pixel-char\\Tiny RPG Character Asset Pack v1.03 -Free Soldier&Orc\\Characters(100x100)\\Soldier\\Soldier with shadows\\";
foreach(glob($dir . "*.png") as $file) {
    if(is_file($file)) {
        $size = getimagesize($file);
        echo basename($file) . ": " . $size[0] . "x" . $size[1] . "\n";
    }
}
$dir = "C:\\Users\\HOME\\Pictures\\pixel-char\\Tiny RPG Character Asset Pack v1.03 -Free Soldier&Orc\\Characters(100x100)\\Orc\\Orc with shadows\\";
foreach(glob($dir . "*.png") as $file) {
    if(is_file($file)) {
        $size = getimagesize($file);
        echo basename($file) . ": " . $size[0] . "x" . $size[1] . "\n";
    }
}
?>
