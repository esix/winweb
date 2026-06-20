(module
(import "env" "putchar" (func $putchar (param i32) (result i32)))
(memory 256)
(export "memory" (memory 0))
(table 0 funcref)
(export "__indirect_function_table" (table 0))
(global $sp (mut i32) (i32.const 16777216))
(func $puts2 (param i32)
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
i32.const 2
local.set $state
br $top
end
local.get 0
local.set 1
local.get 1
i32.const 1
i32.add
local.set 0
local.get 1
i32.load8_s
call $putchar
drop
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
end
)
(func $putint (param i32)
  (local i32)
  (local i32)
  (local i32)
  (local $state i32)
  (local $fb i32)
global.get $sp
i32.const 16
i32.sub
local.tee $fb
global.set $sp
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
i32.const 0
local.set 1
local.get 0
i32.const 0
i32.ge_s
if
i32.const 1
local.set $state
br $top
end
i32.const 45
call $putchar
drop
i32.const 0
local.get 0
i32.sub
local.set 0
end
local.get 0
i32.const 0
i32.ne
if
i32.const 3
local.set $state
br $top
end
i32.const 48
call $putchar
drop
i32.const 6
local.set $state
br $top
end
local.get 1
local.set 2
local.get 2
i32.const 1
i32.add
local.set 1
local.get 2
local.get $fb
i32.add
local.get 0
i32.const 10
i32.rem_s
i32.const 48
i32.add
i32.store8
local.get 0
i32.const 10
i32.div_s
local.set 0
end
local.get 0
i32.const 0
i32.ne
if
i32.const 2
local.set $state
br $top
end
i32.const 5
local.set $state
br $top
end
local.get 1
i32.const 1
i32.sub
local.set 3
local.get 3
local.set 1
local.get 3
local.get $fb
i32.add
i32.load8_s
call $putchar
drop
end
local.get 1
i32.const 0
i32.ne
if
i32.const 4
local.set $state
br $top
end
end
end
end
local.get $fb
i32.const 16
i32.add
global.set $sp
)
(func $fib (param i32) (result i32)
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
local.get 0
i32.const 2
i32.ge_s
if
i32.const 1
local.set $state
br $top
end
local.get 0
local.set 1
i32.const 2
local.set $state
br $top
end
local.get 0
i32.const 1
i32.sub
call $fib
local.set 2
local.get 0
i32.const 2
i32.sub
call $fib
local.set 3
local.get 2
local.get 3
i32.add
local.set 1
end
local.get 1
return
end
end
end
unreachable
)
(func $main (result i32)
  (local i32)
  (local i32)
  (local $state i32)
  (local $fb i32)
global.get $sp
i32.const 16
i32.sub
local.tee $fb
global.set $sp
block $exit
loop $top
block $S3
block $S2
block $S1
block $S0
local.get $state
br_table $S0 $S1 $S2 $S3 $exit
end
i32.const 524312
call $puts2
i32.const 524306
call $puts2
i32.const 0
local.set 0
end
local.get 0
call $fib
local.set 1
local.get 1
call $putint
i32.const 32
call $putchar
drop
end
local.get 0
i32.const 1
i32.add
local.set 0
local.get 0
i32.const 12
i32.lt_s
if
i32.const 1
local.set $state
br $top
end
i32.const 10
call $putchar
drop
local.get $fb
i32.const 3
i32.store
local.get $fb
i32.const 4
i32.add
i32.const 4
i32.store
i32.const 524288
call $puts2
local.get $fb
i32.load
local.get $fb
i32.const 4
i32.add
i32.load
i32.mul
call $putint
i32.const 10
call $putchar
drop
i32.const 0
local.get $fb
i32.const 16
i32.add
global.set $sp
return
end
end
end
unreachable
)
(export "puts2" (func $puts2))
(export "putint" (func $putint))
(export "fib" (func $fib))
(export "main" (func $main))
(data (i32.const 524288) "\73\74\72\75\63\74\20\70\2e\78\2a\70\2e\79\20\3d\20\00")
(data (i32.const 524306) "\66\69\62\3a\20\00")
(data (i32.const 524312) "\6c\63\63\2d\77\61\73\6d\20\72\75\6e\6e\69\6e\67\20\69\6e\73\69\64\65\20\77\69\6e\77\65\62\21\0a\00")
)
