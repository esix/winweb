(module
(import "env" "winweb_cc" (func $winweb_cc (param i32) (param i32) (result i32)))
(import "env" "winweb_exec" (func $winweb_exec (param i32) (result i32)))
(import "env" "winweb_con_clear" (func $winweb_con_clear (param i32)))
(import "env" "winweb_vfs" (func $winweb_vfs (param i32) (param i32) (param i32) (param i32) (result i32)))
(import "env" "WriteConsoleA" (func $WriteConsoleA (param i32) (param i32) (param i32) (param i32) (param i32) (result i32)))
(import "env" "GetStdHandle" (func $GetStdHandle (param i32) (result i32)))
(import "env" "SetConsoleTitleA" (func $SetConsoleTitleA (param i32) (result i32)))
(import "env" "AllocConsole" (func $AllocConsole (result i32)))
(memory 256)
(export "memory" (memory 0))
(table 0 funcref)
(export "__indirect_function_table" (table 0))
(global $sp (mut i32) (i32.const 16777216))
(func $wstrlen_ (param i32) (result i32)
  (local i32)
  (local $state i32)
block $exit
loop $top
block $S3
block $S2
block $S1
block $S0
local.get $state
br_table $S0 $S1 $S2 $S3 $exit
end
local.get 0
local.set 1
i32.const 2
local.set $state
br $top
end
local.get 1
i32.const 1
i32.add
local.set 1
end
local.get 1
i32.load8_s
i32.const 0
i32.ne
if
i32.const 1
local.set $state
br $top
end
local.get 1
local.get 0
i32.sub
return
end
end
end
unreachable
)
(func $wstrcpy_ (param i32) (param i32) (result i32)
  (local i32)
  (local i32)
  (local i32)
  (local i32)
  (local i32)
  (local $state i32)
block $exit
loop $top
block $S3
block $S2
block $S1
block $S0
local.get $state
br_table $S0 $S1 $S2 $S3 $exit
end
local.get 0
local.set 0
local.get 1
local.set 1
local.get 0
local.set 2
end
end
local.get 0
local.set 3
i32.const 1
local.set 5
local.get 3
local.get 5
i32.add
local.set 0
local.get 1
local.set 4
local.get 4
local.get 5
i32.add
local.set 1
local.get 4
i32.load8_s
local.set 6
local.get 3
local.get 6
i32.store8
local.get 6
i32.const 0
i32.ne
if
i32.const 1
local.set $state
br $top
end
local.get 2
return
end
end
end
unreachable
)
(func $wstrcat_ (param i32) (param i32) (result i32)
  (local i32)
  (local i32)
  (local i32)
  (local i32)
  (local i32)
  (local $state i32)
block $exit
loop $top
block $S5
block $S4
block $S3
block $S2
block $S1
block $S0
local.get $state
br_table $S0 $S1 $S2 $S3 $S4 $S5 $exit
end
local.get 0
local.set 0
local.get 1
local.set 1
local.get 0
local.set 2
i32.const 2
local.set $state
br $top
end
local.get 0
i32.const 1
i32.add
local.set 0
end
local.get 0
i32.load8_s
i32.const 0
i32.ne
if
i32.const 1
local.set $state
br $top
end
end
end
local.get 0
local.set 3
i32.const 1
local.set 5
local.get 3
local.get 5
i32.add
local.set 0
local.get 1
local.set 4
local.get 4
local.get 5
i32.add
local.set 1
local.get 4
i32.load8_s
local.set 6
local.get 3
local.get 6
i32.store8
local.get 6
i32.const 0
i32.ne
if
i32.const 3
local.set $state
br $top
end
local.get 2
return
end
end
end
unreachable
)
(func $wstrchr_ (param i32) (param i32) (result i32)
  (local i32)
  (local $state i32)
block $exit
loop $top
block $S6
block $S5
block $S4
block $S3
block $S2
block $S1
block $S0
local.get $state
br_table $S0 $S1 $S2 $S3 $S4 $S5 $S6 $exit
end
local.get 0
local.set 0
local.get 1
local.set 1
i32.const 3
local.set $state
br $top
end
local.get 0
i32.load8_s
local.get 1
i32.ne
if
i32.const 2
local.set $state
br $top
end
local.get 0
return
i32.const 6
local.set $state
br $top
end
local.get 0
i32.const 1
i32.add
local.set 0
end
local.get 0
i32.load8_s
i32.const 0
i32.ne
if
i32.const 1
local.set $state
br $top
end
local.get 1
i32.const 0
i32.ne
if
i32.const 4
local.set $state
br $top
end
local.get 0
local.set 2
i32.const 5
local.set $state
br $top
end
i32.const 0
local.set 2
end
local.get 2
return
end
end
end
unreachable
)
(func $wstrrchr_ (param i32) (param i32) (result i32)
  (local i32)
  (local i32)
  (local $state i32)
block $exit
loop $top
block $S4
block $S3
block $S2
block $S1
block $S0
local.get $state
br_table $S0 $S1 $S2 $S3 $S4 $exit
end
local.get 0
local.set 0
local.get 1
local.set 1
i32.const 0
local.set 2
end
local.get 0
i32.load8_s
local.get 1
i32.ne
if
i32.const 2
local.set $state
br $top
end
local.get 0
local.set 2
end
end
local.get 0
local.set 3
local.get 3
i32.const 1
i32.add
local.set 0
local.get 3
i32.load8_s
i32.const 0
i32.ne
if
i32.const 1
local.set $state
br $top
end
local.get 2
return
end
end
end
unreachable
)
(func $wstrcmp_ (param i32) (param i32) (result i32)
  (local i32)
  (local i32)
  (local $state i32)
block $exit
loop $top
block $S4
block $S3
block $S2
block $S1
block $S0
local.get $state
br_table $S0 $S1 $S2 $S3 $S4 $exit
end
local.get 0
local.set 0
local.get 1
local.set 1
i32.const 2
local.set $state
br $top
end
i32.const 1
local.set 2
local.get 0
local.get 2
i32.add
local.set 0
local.get 1
local.get 2
i32.add
local.set 1
end
local.get 0
i32.load8_s
local.set 3
local.get 3
i32.const 0
i32.eq
if
i32.const 3
local.set $state
br $top
end
local.get 3
local.get 1
i32.load8_s
i32.eq
if
i32.const 1
local.set $state
br $top
end
end
local.get 0
i32.load8_s
local.get 1
i32.load8_s
i32.sub
return
end
end
end
unreachable
)
(func $wmemmove_ (param i32) (param i32) (param i32) (result i32)
  (local i32)
  (local i32)
  (local i32)
  (local i32)
  (local i32)
  (local i32)
  (local i32)
  (local i32)
  (local i32)
  (local i32)
  (local i32)
  (local $state i32)
block $exit
loop $top
block $S7
block $S6
block $S5
block $S4
block $S3
block $S2
block $S1
block $S0
local.get $state
br_table $S0 $S1 $S2 $S3 $S4 $S5 $S6 $S7 $exit
end
local.get 2
local.set 2
local.get 0
local.set 3
local.get 1
local.set 4
local.get 3
local.get 4
i32.ge_u
if
i32.const 3
local.set $state
br $top
end
i32.const 2
local.set $state
br $top
end
local.get 3
local.set 5
i32.const 1
local.set 7
local.get 5
local.get 7
i32.add
local.set 3
local.get 4
local.set 6
local.get 6
local.get 7
i32.add
local.set 4
local.get 5
local.get 6
i32.load8_s
i32.store8
end
local.get 2
local.set 8
local.get 8
i32.const 1
i32.sub
local.set 2
local.get 8
i32.const 0
i32.ne
if
i32.const 1
local.set $state
br $top
end
i32.const 6
local.set $state
br $top
end
local.get 2
local.get 3
i32.add
local.set 3
local.get 2
local.get 4
i32.add
local.set 4
i32.const 5
local.set $state
br $top
end
i32.const -1
local.set 10
local.get 3
local.get 10
i32.add
local.set 11
local.get 11
local.set 3
local.get 4
local.get 10
i32.add
local.set 12
local.get 12
local.set 4
local.get 11
local.get 12
i32.load8_s
i32.store8
end
local.get 2
local.set 13
local.get 13
i32.const 1
i32.sub
local.set 2
local.get 13
i32.const 0
i32.ne
if
i32.const 4
local.set $state
br $top
end
end
local.get 0
return
end
end
end
unreachable
)
(func $wlower_ (param i32) (result i32)
  (local i32)
  (local i32)
  (local $state i32)
block $exit
loop $top
block $S3
block $S2
block $S1
block $S0
local.get $state
br_table $S0 $S1 $S2 $S3 $exit
end
local.get 0
local.set 0
local.get 0
i32.const 65
i32.lt_s
if
i32.const 1
local.set $state
br $top
end
local.get 0
i32.const 90
i32.gt_s
if
i32.const 1
local.set $state
br $top
end
local.get 0
i32.const 32
i32.add
local.set 1
i32.const 2
local.set $state
br $top
end
local.get 0
local.set 1
end
local.get 1
return
end
end
end
unreachable
)
(func $wstrcasecmp_ (param i32) (param i32) (result i32)
  (local i32)
  (local i32)
  (local i32)
  (local i32)
  (local i32)
  (local i32)
  (local $state i32)
block $exit
loop $top
block $S4
block $S3
block $S2
block $S1
block $S0
local.get $state
br_table $S0 $S1 $S2 $S3 $S4 $exit
end
local.get 0
local.set 0
local.get 1
local.set 1
i32.const 2
local.set $state
br $top
end
i32.const 1
local.set 2
local.get 0
local.get 2
i32.add
local.set 0
local.get 1
local.get 2
i32.add
local.set 1
end
local.get 0
i32.load8_s
local.set 3
local.get 3
i32.const 0
i32.eq
if
i32.const 3
local.set $state
br $top
end
local.get 3
call $wlower_
local.set 4
local.get 1
i32.load8_s
call $wlower_
local.set 5
local.get 4
local.get 5
i32.eq
if
i32.const 1
local.set $state
br $top
end
end
local.get 0
i32.load8_s
call $wlower_
local.set 6
local.get 1
i32.load8_s
call $wlower_
local.set 7
local.get 6
local.get 7
i32.sub
return
end
end
end
unreachable
)
(func $input_buf (result i32)
i32.const 320
return
)
(func $vfs (param i32) (param i32) (result i32)
  (local i32)
local.get 0
local.get 1
i32.const 832
i32.const 65536
call $winweb_vfs
local.set 2
local.get 2
return
)
(func $w (param i32) (param i32)
  (local i32)
  (local $fb i32)
global.get $sp
i32.const 16
i32.sub
local.tee $fb
global.set $sp
local.get 1
call $wstrlen_
local.set 2
local.get 0
local.get 1
local.get 2
local.get $fb
i32.const 0
call $WriteConsoleA
drop
local.get $fb
i32.const 16
i32.add
global.set $sp
)
(func $prompt
i32.const 316
i32.load
i32.const 16
call $w
i32.const 316
i32.load
i32.const 524716
call $w
)
(func $resolve (param i32) (param i32)
  (local i32)
  (local i32)
  (local i32)
  (local $state i32)
block $exit
loop $top
block $S4
block $S3
block $S2
block $S1
block $S0
local.get $state
br_table $S0 $S1 $S2 $S3 $S4 $exit
end
local.get 0
local.set 0
local.get 1
local.set 1
local.get 0
i32.load8_s
i32.const 0
i32.ne
if
i32.const 1
local.set $state
br $top
end
local.get 1
i32.const 16
call $wstrcpy_
drop
i32.const 4
local.set $state
br $top
end
local.get 0
i32.const 1
i32.add
i32.load8_s
i32.const 58
i32.ne
if
i32.const 2
local.set $state
br $top
end
local.get 1
local.get 0
call $wstrcpy_
drop
i32.const 4
local.set $state
br $top
end
local.get 1
i32.const 16
call $wstrcpy_
drop
local.get 1
call $wstrlen_
local.set 3
local.get 3
local.set 2
local.get 2
i32.const 0
i32.eq
if
i32.const 3
local.set $state
br $top
end
local.get 2
i32.const 1
i32.sub
local.get 1
i32.add
i32.load8_s
i32.const 92
i32.eq
if
i32.const 3
local.set $state
br $top
end
local.get 1
i32.const 524714
call $wstrcat_
drop
end
local.get 1
local.get 0
call $wstrcat_
drop
end
end
end
)
(func $init
  (local i32)
call $AllocConsole
drop
i32.const 524699
call $SetConsoleTitleA
drop
i32.const 4294967285
call $GetStdHandle
local.set 0
i32.const 316
local.get 0
i32.store
i32.const 316
i32.load
i32.const 524637
call $w
call $prompt
)
(func $process_line
  (local i32)
  (local i32)
  (local i32)
  (local i32)
  (local i32)
  (local i32)
  (local i32)
  (local i32)
  (local i32)
  (local i32)
  (local i32)
  (local i32)
  (local i32)
  (local i32)
  (local i32)
  (local i32)
  (local i32)
  (local i32)
  (local i32)
  (local i32)
  (local i32)
  (local i32)
  (local i32)
  (local i32)
  (local i32)
  (local $state i32)
  (local $fb i32)
global.get $sp
i32.const 816
i32.sub
local.tee $fb
global.set $sp
block $exit
loop $top
block $S37
block $S36
block $S35
block $S34
block $S33
block $S32
block $S31
block $S30
block $S29
block $S28
block $S27
block $S26
block $S25
block $S24
block $S23
block $S22
block $S21
block $S20
block $S19
block $S18
block $S17
block $S16
block $S15
block $S14
block $S13
block $S12
block $S11
block $S10
block $S9
block $S8
block $S7
block $S6
block $S5
block $S4
block $S3
block $S2
block $S1
block $S0
local.get $state
br_table $S0 $S1 $S2 $S3 $S4 $S5 $S6 $S7 $S8 $S9 $S10 $S11 $S12 $S13 $S14 $S15 $S16 $S17 $S18 $S19 $S20 $S21 $S22 $S23 $S24 $S25 $S26 $S27 $S28 $S29 $S30 $S31 $S32 $S33 $S34 $S35 $S36 $S37 $exit
end
local.get $fb
i32.const 320
call $wstrcpy_
drop
local.get $fb
local.set 0
i32.const 2
local.set $state
br $top
end
local.get 0
i32.const 1
i32.add
local.set 0
end
local.get 0
i32.load8_s
local.set 3
local.get 3
i32.const 0
i32.eq
if
i32.const 3
local.set $state
br $top
end
local.get 3
i32.const 13
i32.eq
if
i32.const 3
local.set $state
br $top
end
local.get 3
i32.const 10
i32.ne
if
i32.const 1
local.set $state
br $top
end
end
local.get 0
i32.const 0
i32.store8
i32.const 5
local.set $state
br $top
end
local.get $fb
call $wstrlen_
local.set 4
local.get $fb
local.get $fb
i32.const 1
i32.add
local.get 4
call $wmemmove_
drop
end
local.get $fb
i32.load8_s
i32.const 32
i32.eq
if
i32.const 4
local.set $state
br $top
end
local.get $fb
i32.load8_s
i32.const 0
i32.ne
if
i32.const 6
local.set $state
br $top
end
call $prompt
i32.const 37
local.set $state
br $top
end
local.get $fb
i32.const 32
call $wstrchr_
local.set 5
local.get 5
local.set 1
local.get 1
i32.const 0
i32.eq
if
i32.const 9
local.set $state
br $top
end
local.get 1
local.set 6
local.get 6
i32.const 1
i32.add
local.set 1
local.get 6
i32.const 0
i32.store8
i32.const 8
local.set $state
br $top
end
local.get 1
i32.const 1
i32.add
local.set 1
end
local.get 1
i32.load8_s
i32.const 32
i32.eq
if
i32.const 7
local.set $state
br $top
end
i32.const 10
local.set $state
br $top
end
local.get $fb
call $wstrlen_
local.set 7
local.get 7
local.get $fb
i32.add
local.set 1
end
local.get $fb
i32.const 524632
call $wstrcasecmp_
local.set 8
local.get 8
i32.const 0
i32.ne
if
i32.const 11
local.set $state
br $top
end
i32.const 316
i32.load
i32.const 524603
call $w
i32.const 36
local.set $state
br $top
end
local.get $fb
i32.const 524599
call $wstrcasecmp_
local.set 9
local.get 9
i32.const 0
i32.ne
if
i32.const 12
local.set $state
br $top
end
i32.const 316
i32.load
call $winweb_con_clear
call $prompt
i32.const 37
local.set $state
br $top
end
local.get $fb
i32.const 524594
call $wstrcasecmp_
local.set 10
local.get 10
i32.const 0
i32.ne
if
i32.const 13
local.set $state
br $top
end
i32.const 316
i32.load
local.get 1
call $w
i32.const 316
i32.load
i32.const 524591
call $w
i32.const 35
local.set $state
br $top
end
local.get $fb
i32.const 524587
call $wstrcasecmp_
local.set 11
local.get 11
i32.const 0
i32.ne
if
i32.const 14
local.set $state
br $top
end
i32.const 316
i32.load
i32.const 524551
call $w
i32.const 34
local.set $state
br $top
end
local.get $fb
i32.const 524546
call $wstrcasecmp_
local.set 12
local.get 12
i32.const 0
i32.ne
if
i32.const 15
local.set $state
br $top
end
i32.const 316
i32.load
i32.const 524459
call $w
i32.const 33
local.set $state
br $top
end
local.get $fb
i32.const 524456
call $wstrcasecmp_
local.set 13
local.get 13
i32.const 0
i32.ne
if
i32.const 17
local.set $state
br $top
end
local.get 1
i32.load8_s
i32.const 0
i32.ne
if
i32.const 16
local.set $state
br $top
end
i32.const 316
i32.load
i32.const 524435
call $w
i32.const 32
local.set $state
br $top
end
local.get 1
local.get $fb
i32.const 512
i32.add
call $resolve
local.get $fb
i32.const 512
i32.add
i32.const 316
i32.load
call $winweb_cc
drop
i32.const 32
local.set $state
br $top
end
local.get $fb
i32.const 524431
call $wstrcasecmp_
local.set 14
local.get 14
i32.const 0
i32.ne
if
i32.const 18
local.set $state
br $top
end
local.get 1
local.get $fb
i32.const 512
i32.add
call $resolve
i32.const 0
local.get $fb
i32.const 512
i32.add
call $vfs
drop
i32.const 316
i32.load
i32.const 832
call $w
i32.const 31
local.set $state
br $top
end
local.get $fb
i32.const 524426
call $wstrcasecmp_
local.set 15
local.get 15
i32.const 0
i32.ne
if
i32.const 19
local.set $state
br $top
end
local.get 1
local.get $fb
i32.const 512
i32.add
call $resolve
i32.const 1
local.get $fb
i32.const 512
i32.add
call $vfs
drop
i32.const 316
i32.load
i32.const 832
call $w
i32.const 316
i32.load
i32.const 524591
call $w
i32.const 30
local.set $state
br $top
end
local.get $fb
i32.const 524423
call $wstrcasecmp_
local.set 16
local.get 16
i32.const 0
i32.eq
if
i32.const 20
local.set $state
br $top
end
local.get $fb
i32.const 524417
call $wstrcasecmp_
local.set 17
local.get 17
i32.const 0
i32.ne
if
i32.const 25
local.set $state
br $top
end
end
local.get 1
i32.load8_s
i32.const 0
i32.eq
if
i32.const 21
local.set $state
br $top
end
local.get 1
i32.const 524415
call $wstrcmp_
local.set 19
local.get 19
i32.const 0
i32.ne
if
i32.const 22
local.set $state
br $top
end
end
i32.const 316
i32.load
i32.const 16
call $w
i32.const 316
i32.load
i32.const 524591
call $w
i32.const 29
local.set $state
br $top
end
local.get 1
i32.const 524412
call $wstrcmp_
local.set 20
local.get 20
i32.const 0
i32.ne
if
i32.const 24
local.set $state
br $top
end
i32.const 16
i32.const 92
call $wstrrchr_
local.set 22
local.get 22
local.set 21
local.get 21
local.set 23
local.get 23
i32.const 0
i32.eq
if
i32.const 23
local.set $state
br $top
end
local.get 23
i32.const 18
i32.le_u
if
i32.const 23
local.set $state
br $top
end
local.get 21
i32.const 0
i32.store8
i32.const 29
local.set $state
br $top
end
i32.const 16
i32.const 524408
call $wstrcpy_
drop
i32.const 29
local.set $state
br $top
end
local.get 1
local.get $fb
i32.const 512
i32.add
call $resolve
i32.const 16
local.get $fb
i32.const 512
i32.add
call $wstrcpy_
drop
i32.const 29
local.set $state
br $top
end
local.get $fb
local.get $fb
i32.const 512
i32.add
call $resolve
local.get $fb
i32.const 512
i32.add
call $winweb_exec
local.set 24
local.get 24
local.set 2
local.get 2
i32.const 2
i32.ne
if
i32.const 26
local.set $state
br $top
end
i32.const 316
i32.load
i32.const 524337
call $w
i32.const 28
local.set $state
br $top
end
local.get 2
i32.const 1
i32.eq
if
i32.const 27
local.set $state
br $top
end
i32.const 316
i32.load
i32.const 524335
call $w
i32.const 316
i32.load
local.get $fb
call $w
i32.const 316
i32.load
i32.const 524288
call $w
end
end
end
end
end
end
end
end
end
end
call $prompt
end
end
end
local.get $fb
i32.const 816
i32.add
global.set $sp
)
(export "input_buf" (func $input_buf))
(export "init" (func $init))
(export "process_line" (func $process_line))
(data (i32.const 16) "\43\3a\5c\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00")
(data (i32.const 316) "\00\00\00\00")
(data (i32.const 524288) "\27\20\69\73\20\6e\6f\74\20\72\65\63\6f\67\6e\69\7a\65\64\20\61\73\20\61\20\63\6f\6d\6d\61\6e\64\20\6f\72\20\70\72\6f\67\72\61\6d\2e\0d\0a\00")
(data (i32.const 524335) "\27\00")
(data (i32.const 524337) "\43\61\6e\6e\6f\74\20\65\78\65\63\75\74\65\20\6e\61\74\69\76\65\20\50\45\20\28\2e\65\78\65\29\20\2d\20\6e\6f\20\78\38\36\20\65\6d\75\6c\61\74\69\6f\6e\3b\20\6f\6e\6c\79\20\2e\77\61\73\6d\20\72\75\6e\73\2e\0d\0a\00")
(data (i32.const 524408) "\43\3a\5c\00")
(data (i32.const 524412) "\2e\2e\00")
(data (i32.const 524415) "\2e\00")
(data (i32.const 524417) "\63\68\64\69\72\00")
(data (i32.const 524423) "\63\64\00")
(data (i32.const 524426) "\74\79\70\65\00")
(data (i32.const 524431) "\64\69\72\00")
(data (i32.const 524435) "\75\73\61\67\65\3a\20\63\63\20\3c\66\69\6c\65\2e\63\3e\0d\0a\00")
(data (i32.const 524456) "\63\63\00")
(data (i32.const 524459) "\44\49\52\20\20\43\44\20\20\54\59\50\45\20\20\45\43\48\4f\20\20\43\4c\53\20\20\56\45\52\20\20\43\43\20\20\48\45\4c\50\20\20\45\58\49\54\20\20\20\28\72\75\6e\3a\20\6e\61\6d\65\2e\77\61\73\6d\3b\20\63\6f\6d\70\69\6c\65\3a\20\63\63\20\66\69\6c\65\2e\63\29\0d\0a\00")
(data (i32.const 524546) "\68\65\6c\70\00")
(data (i32.const 524551) "\0d\0a\77\69\6e\77\65\62\20\56\65\72\73\69\6f\6e\20\31\2e\30\20\28\6c\63\63\2d\77\61\73\6d\29\0d\0a\0d\0a\00")
(data (i32.const 524587) "\76\65\72\00")
(data (i32.const 524591) "\0d\0a\00")
(data (i32.const 524594) "\65\63\68\6f\00")
(data (i32.const 524599) "\63\6c\73\00")
(data (i32.const 524603) "\28\63\6c\6f\73\65\20\74\68\65\20\77\69\6e\64\6f\77\20\74\6f\20\65\78\69\74\29\0d\0a\00")
(data (i32.const 524632) "\65\78\69\74\00")
(data (i32.const 524637) "\77\69\6e\77\65\62\20\5b\56\65\72\73\69\6f\6e\20\31\2e\30\5d\0d\0a\28\63\29\20\77\69\6e\77\65\62\2e\20\54\79\70\65\20\48\45\4c\50\20\66\6f\72\20\63\6f\6d\6d\61\6e\64\73\2e\0d\0a\0d\0a\00")
(data (i32.const 524699) "\43\6f\6d\6d\61\6e\64\20\50\72\6f\6d\70\74\00")
(data (i32.const 524714) "\5c\00")
(data (i32.const 524716) "\3e\00")
)
