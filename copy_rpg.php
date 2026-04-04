<?php
$base_src = "C:\\Users\\HOME\\Pictures\\pixel-char\\Tiny RPG Character Asset Pack v1.03 -Free Soldier&Orc\\Characters(100x100)\\";
$dst_soldier = __DIR__ . "\\assets\\soldier\\";
$dst_orc = __DIR__ . "\\assets\\orc\\";

@mkdir($dst_soldier, 0777, true);
@mkdir($dst_orc, 0777, true);

$files_to_copy = [
    $base_src . "Soldier\\Soldier with shadows\\Soldier-Walk.png" => $dst_soldier . "walk.png",
    $base_src . "Soldier\\Soldier with shadows\\Soldier-Attack01.png" => $dst_soldier . "attack.png",
    $base_src . "Orc\\Orc with shadows\\Orc-Walk.png" => $dst_orc . "walk.png",
    $base_src . "Orc\\Orc with shadows\\Orc-Attack01.png" => $dst_orc . "attack.png",
];

foreach ($files_to_copy as $src => $dst) {
    if (file_exists($src)) {
        copy($src, $dst);
        echo "Copied: " . basename($src) . "\n";
    } else {
        echo "NOT FOUND: " . $src . "\n";
    }
}
?>
