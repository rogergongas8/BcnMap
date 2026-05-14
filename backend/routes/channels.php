<?php

use Illuminate\Support\Facades\Broadcast;

// Canal público — cualquier cliente puede suscribirse
Broadcast::channel('city-data', fn() => true);
