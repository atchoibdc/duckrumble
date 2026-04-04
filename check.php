<?php
$dirs = ['Monk', 'Warrior', 'Lancer'];
$maps = [
    'Warrior' => ['Warrior_Idle.png', 'Warrior_Run.png', 'Warrior_Attack1.png'],
    'Lancer' => ['Lancer_Idle.png', 'Lancer_Run.png', 'Lancer_Right_Attack.png'],
    'Monk' => ['Idle.png', 'Run.png', 'Heal.png']
];

foreach ($dirs as $dir) {
    echo "--- $dir ---\n";
    foreach ($maps[$dir] as $f) {
        $path = "assets/Units/Blue Units/$dir/$f";
        if (file_exists($path)) {
            $info = getimagesize($path);
            echo "$f: " . $info[0] . "x" . $info[1] . " frames: " . ($info[0] / $info[1]) . "\n";
        } else {
            echo "$f not found\n";
        }
    }
}
