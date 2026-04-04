<?php
$src = "C:\\Users\\HOME\\Downloads\\create_a_2d_sprite_chibi_warrior_class_character_t (1)";
$dst = __DIR__ . "\\assets\\warrior";

function custom_copy($src, $dst) { 
    $dir = opendir($src); 
    @mkdir($dst, 0777, true); 
    while( $file = readdir($dir) ) { 
        if (( $file != '.' ) && ( $file != '..' )) { 
            if ( is_dir($src . '/' . $file) ) { 
                custom_copy($src . '/' . $file, $dst . '/' . $file); 
            } else { 
                copy($src . '/' . $file, $dst . '/' . $file); 
            } 
        } 
    } 
    closedir($dir);
} 

custom_copy($src, $dst);
echo "SUCCESS";
?>
