# Importación Táctica

Sistema de inventario, armado y pedidos. Decants de perfume y accesorios.

- **Stack:** Next.js 16 (App Router) · TypeScript · Tailwind 4 · Supabase
- **Roles:** `admin` y `cliente`
- **Sedes:** Banfield (central, recibe las importaciones) y Monte Grande


## Cómo está organizado

```
src/
├── app/
│   ├── (auth)/          login · registro · acciones de sesión
│   ├── (panel)/         admin: layout, dashboard y secciones
│   ├── (portal)/        cliente: catálogo y pedidos
│   ├── auth/callback/   vuelta del mail de confirmación
│   └── page.tsx         raíz: manda a cada quien a su lado
├── components/          navegación, selector de sede, campanita
├── lib/
│   ├── supabase/        clientes de servidor, navegador y proxy
│   ├── auth.ts          getPerfil · requireAdmin · requireCliente
│   ├── sede.ts          sede activa (cookie + preferencia del perfil)
│   ├── secciones.ts     secciones del panel y en qué fase se construyen
│   └── format.ts        pesos, fechas y enlaces wa.me
├── types/database.ts    tipos de la base
└── proxy.ts             refresca la sesión y corta el paso sin login
```


**La lógica de stock vive en PostgreSQL, no acá.** `fn_registrar_movimiento`,
`fn_reservar_items_pedido`, `fn_completar_armado` y `fn_recibir_importacion`
son funciones de la base. Son transaccionales y tienen que ser atómicas: si la
reserva se hiciera en TypeScript, dos pedidos simultáneos podrían leer el mismo
disponible y comprometer los mismos frascos. En la base, el `SELECT … FOR
UPDATE` lo impide. Desde la app se llaman con `supabase.rpc()`.

**Las fechas se guardan en UTC y el negocio vive en Argentina.** Una venta de
las 21:00 de un martes es la medianoche del miércoles en UTC: si el reporte
truncara sin convertir, la contaría en el día equivocado. Por eso todo lo que
agrupa por fecha pasa por `fn_zona()` / `fn_fecha_local()`, y "hoy" se pide con
`fn_hoy()` o con `hoyLocal()` del lado del cliente — nunca con `current_date`
ni `new Date().toISOString()`.

**Las vistas no respetan RLS por sí solas.** Una vista de Postgres corre con
los permisos de su *dueño*, no de quien consulta, así que saltea las políticas
de las tablas de base. Por eso las vistas internas llevan adentro el filtro
`fn_acceso_interno()`. Si agregás una vista que toque stock, costos o merma,
**acordate de incluirlo** o vas a estar exponiendo esos datos a cualquier
cliente logueado. Las únicas dos vistas públicas son `v_catalogo` y
`v_precios_publicos`, y exponen sólo disponibilidad y precio de venta.

---

## El catálogo

El catálogo tiene dos niveles y conviene tenerlos claros antes de cargar nada:

- **Producto** es el concepto: *Jeringa de carga*. No se stockea ni se vende.
- **Variante** es el SKU real: *JER-5ML*. Tiene stock, precio y — si es armada —
  receta. Es lo que entra en un pedido.

Al crear el producto se declara **qué distingue a sus variantes** (`capacidad`,
o `capacidad, color de tapa` si son dos). Después, al cargar cada variante, el
SKU se sugiere solo a partir de esos valores: `JER` + `5 ml` → `JER-5ML`. Si el
sugerido no gusta, se pisa a mano y el sistema deja de sugerir.

### Las tres clases de variante

| Clase | Qué es | Receta | Precio | La ve el cliente |
|---|---|---|---|---|
| **Simple** | Se compra armado y se vende tal cual (jeringa, adaptador) | no | sí | sí |
| **Armado** | Se arma con insumos (decant) | **sí, obligatoria** | sí | sí |
| **Insumo** | Sólo entra en recetas (frasco, tapa, atomizador) | no | no | no |

La receta es de **un solo nivel**: un armado se compone de insumos, nunca de
otro armado. La base lo rechaza con un mensaje explícito, y el selector de
insumos directamente no ofrece los armados. Es a propósito: con recetas
anidadas, calcular qué se puede armar y cuánto cuesta se vuelve un problema de
grafos, y para menos de 50 SKUs no compensa.

Cada renglón de la receta lleva una **merma esperada** en porcentaje — los
frascos que se rompen al armar. Sirve después para comparar contra la merma
real de cada orden de armado.

### Precios por rango

El precio se carga por escalones de cantidad: *desde 1 → $1.500*, *desde 10 →
$1.200*, *desde 50 → $1.000*. El sistema arma solo los rangos (1–9, 10–49, 50 y
más). 

Al lado de cada escalón aparece el **margen** contra el costo real de la
variante. En la pantalla **Precios** se ve todo junto, con
el margen mínimo de cada producto marcado en ámbar cuando baja del 100 %.

### Qué falta para poder vender

Arriba del catálogo hay un aviso con las variantes que todavía no se pueden
vender, y cada una queda marcada con el motivo:

- *Falta cargarle la receta* — es un armado sin insumos definidos
- *Falta cargarle el precio* — no tiene ningún escalón cargado
- *El producto no está publicado* — está listo pero el cliente no lo ve

Los insumos nunca aparecen en esa lista: no se venden sueltos.

---

## Stock y armado

### El stock es un libro mayor, no un número

La tabla `stock` guarda el saldo, pero la verdad está en `movimientos_stock`:
cada entrada y cada salida queda registrada con el saldo antes y después, quién
la hizo y por qué. **Esa tabla no se edita ni se borra** — un trigger lo impide.
Si algo se cargó mal, se corrige con un ajuste en contrario, y las dos líneas
quedan a la vista. Es lo que permite que el número de hoy se pueda explicar
dentro de seis meses.

La ficha de cada producto (`Stock → clic en el nombre`) muestra ese historial
completo, filtrable por sede.

### Contar

El botón **Contar** de cada fila es la operación de inventario: se pone lo que
se contó y el sistema calcula la diferencia solo. **El motivo es obligatorio.**
Un ajuste sin explicación es exactamente el tipo de agujero que hace que después
nadie confíe en el número.

Contar lo mismo que ya había no genera movimiento, sólo actualiza la fecha del
último conteo.

### Mínimos

Cada producto puede tener un mínimo **por sede**. Debajo del mínimo, el producto
queda marcado en el listado, entra en el aviso de arriba y aparece en las
sugerencias de armado. También se le puede anotar dónde está guardado
(*Estante A, caja 3*), que es lo que hace que buscar algo sea rápido.

### Armar

La pantalla de Armado arranca con **¿qué dejé armado?**: cuánto hay listo para
salir, cuánto está comprometido, cuánto más se podría armar y — cuando no
alcanza — **qué insumo es el que corta**.

Registrar un armado es un solo formulario: qué, cuántas, y si se rompió algo. El
consumo normal de la receta se descuenta solo; en el recuadro de rotura va
únicamente lo que se rompió **de más**. Esa rotura:

- descuenta los insumos rotos del stock, además de los consumidos
- **sube el costo unitario real** de esa tanda (se reparte entre las unidades que
  salieron bien)
- queda registrada para la estadística de merma

También se puede **anotar una orden para después** — no mueve stock hasta que se
cierra — y **desarmar**, que devuelve los insumos cuando se armó de más.

### Las funciones que mueven stock están cerradas

Las funciones que tocan stock corren con permisos elevados (necesitan saltearse
las reglas de fila para poder escribir el libro mayor). Cada una de las que están
expuestas a la API verifica primero que quien llama sea admin **según su token**,
no según el rol de conexión. Las internas — el motor de movimientos, el armado
crudo, las de pedidos e importaciones — directamente no están otorgadas a los
usuarios: sólo se llaman desde adentro.

---

## Costos y borrado

### De dónde sale el costo de cada cosa

| | Costo |
|---|---|
| **Insumo** o **producto simple** | Se carga a mano en la ficha, o entra solo con la importación |
| **Producto armado** | **No se carga**: es la suma de su receta |

Si sube el frasco, todos los decants que lo llevan se actualizan solos — no hay
que tocar nada. La ficha del armado muestra el desglose, línea por línea.

Se edita en **Catálogo → el producto → el campo "Costo unitario"** de cada
variante. Cada cambio queda auditado con su motivo.

### La merma no toca el costo

Romper frascos **no encarece el producto**. Ni al armar ni al importar:

- si se rompen 3 frascos armando 10 decants, salen del stock, quedan en la
  estadística de merma, y el decant sigue costando lo mismo


La merma es una medición: cuánto se está rompiendo y dónde. No se mezcla con el
costo, así que el margen no se mueve por una mala tanda.

### Eliminar vs. archivar

**Eliminar** borra de verdad, y sólo funciona si el producto **nunca se usó**:
sin movimientos de stock, sin pedidos, sin importaciones, sin ser insumo de
ninguna receta. Es para lo que se cargó mal y hay que sacar de en medio.

Si ya tuvo movimiento, el botón no aparece: dice *no se puede borrar* y al pasar
el mouse explica por qué. Ahí va **archivar**, que lo saca del catálogo y de las
pantallas de venta pero conserva la historia — si no, los reportes de los meses
anteriores dejarían de cuadrar.

Borrar un producto entero exige que todas sus variantes se puedan borrar.

---

## Importaciones y transferencias (Fase 3)

### Un embarque, de punta a punta

1. **Se carga** con su código, cómo viaja, el tipo de cambio y **todos los
   gastos**: flete, seguro, aduana, despachante, flete local.
2. **Se le cargan los productos**: qué viene y a qué precio de origen.
3. **Cuando llega, se recibe**: cuántas unidades entraron de cada cosa y cuántas
   venían rotas.

Recién en el paso 3 pasa todo: entra el stock, los gastos se reparten entre los
productos según el criterio que elijas (por valor, por peso o por unidades), y
cada producto queda con **su costo real**. Después de recibir, el embarque no se
edita más — sus números ya están aplicados al stock.

Mientras no esté recibido se puede corregir todo, que es lo normal: los gastos
reales aparecen de a poco y casi nunca están el primer día.


### Transferencias

Van en las dos direcciones. Tienen tres momentos, y el stock se mueve en dos de
ellos:

- **Borrador** — se arma la lista. Todavía no salió nada.
- **Despachada** — el stock **sale** del origen y queda en viaje.
- **Recibida** — el que recibe confirma qué llegó de verdad y el stock **entra**
  en el destino.

Si falta algo, se anota lo que llegó: la transferencia queda marcada *con
diferencias* y el faltante no entra al destino. Salió y no llegó, que es lo que
realmente pasó — y queda a la vista para reclamarlo.

Al armar la lista, el sistema sólo ofrece lo que hay disponible en la sede de
origen, y avisa con el número exacto si te pasás. Arriba aparecen las
transferencias sugeridas: una sede por debajo de su mínimo y la otra con
sobrante.

---

## Pedidos

### El circuito

**Pendiente** → **Confirmado** → *(armado si hace falta)* → **Listo** →
**Entregado**. El stock se mueve en dos momentos, no en cinco:

- Al **confirmar** se reserva. Nadie más puede vender eso.
- Al **entregar** sale de verdad y se libera la reserva.

Mientras está pendiente se pueden cambiar los renglones libremente: todavía no
tocó nada.

### Reserva mixta

Es lo que hace que un pedido no se frene por no tener stock armado. Al
confirmar, cada renglón se cubre en dos partes:

1. Lo que **ya está armado** se reserva directamente.
2. Por el faltante se reservan **los insumos** necesarios para armarlo.

Si no alcanza ni con los insumos, la confirmación se rechaza entera —nombrando
el insumo que corta— y el pedido queda como estaba. No hay reservas a medias.

En la ficha del pedido se ve renglón por renglón qué sale del stock y qué hay
que armar, y con un botón se generan las órdenes de armado correspondientes, que
aparecen en la pantalla de Armado atadas a ese pedido.

### El precio no se tipea

Sale de la escala por cantidad del catálogo. Si el cliente lleva 12, toma el
precio del escalón de 10 en adelante. Así un pedido no puede quedar con un
precio que no existe en la lista.

### Se cobra antes de entregar

**Esto la base lo hace cumplir**, no es sólo una costumbre: un pedido sin el pago
registrado no pasa a *enviado* ni a *entregado*. Tampoco se entrega si quedan
renglones sin armar. En el listado aparece arriba cuántos pedidos están sin
cobrar, con acceso directo.

### WhatsApp sin API

Cada pedido muestra los mensajes que corresponden a su estado, con el texto ya
escrito —nombre, número de pedido, importe, sede— y un botón que abre WhatsApp
en ese chat. **No se manda solo:** lo leés, lo cambiás si querés, y lo enviás
vos. Sin API de Meta, sin costo por mensaje, sin trámite de aprobación.

Los textos se editan en la tabla `plantillas_texto`.

---

## El portal del cliente 

### Qué ve y qué puede hacer

El cliente se registra, entra a `/portal` y ve **el catálogo con las escalas de
precio** — así entiende solo por qué conviene llevar más. Cada producto dice si
hay stock. Carga cantidades, elige si retira o quiere envío, y confirma.

Después sigue su pedido en **Mis pedidos**, donde el estado está contado en
palabras: *"lo estamos preparando"*, *"listo para que lo pases a buscar"*. Y
mientras el pedido esté pendiente lo puede cancelar solo.

En **Mis datos** carga su WhatsApp y su dirección. Eso es lo que después le
habilita a ustedes el botón para escribirle.

### El pedido del cliente no reserva stock

Nace *pendiente*: no toca el stock hasta que uno de ustedes lo confirma. Así un
pedido web no puede dejarlos sin mercadería comprometida antes de que lo miren.
Cuando entra, les llega un aviso.


### Registrarse no duplica la ficha

Si le vendieron a alguien por WhatsApp y lo cargaron a mano, y esa persona
después se registra en el portal, el sistema **engancha su cuenta a la ficha que
ya existía** en lugar de crear una nueva. Si no, el cliente entraría y no vería
ninguna de sus compras, y en el panel aparecería repetido. La vista
`v_clientes_duplicados` avisa si alguna vez queda alguno.

---

## Reportes

Los cuatro reportes viven en solapas dentro de **Reportes**, y no piden cargar
nada nuevo: salen de lo que el sistema ya venía anotando solo.

### Margen — cuánto se gana con cada cosa

Cada vez que sale mercadería por una venta, el movimiento guarda **el costo que
el producto tenía en ese momento**. Por eso el margen que muestra esta pantalla
es el que realmente pasó, no una estimación con los costos de hoy: si mañana el
proveedor aumenta el frasco, lo vendido el mes pasado sigue valiendo lo que
valió. Se filtra por rango de fechas y sale por producto, con la ganancia total,
el porcentaje sobre la venta y la ganancia por unidad.

### Merma — cuánto se rompe y dónde

Junta las dos roturas en una sola tabla: la que se vio al abrir la caja y la que
apareció recién al armar. Van juntas porque son la misma historia contada en dos
momentos —el golpe del viaje muchas veces se descubre cuando alguien manipula el
frasco, no antes.

Arriba está la comparación que importa para decidir: **por forma de envío**.
Avión contra barco, con su porcentaje de rotura. Eso es lo que después justifica
pagar más flete o aguantar más días de tránsito.

El porcentaje se calcula sobre las unidades que entraron, no sobre la suma de
las dos etapas: el mismo frasco se recibe una vez y después se arma, y sumar
ambas lo contaría dos veces.

Nada de esto toca el costo. La merma es informativa, como quedó definido.

### Rotación — qué se mueve y qué está dormido

Lo que importa no es cuánto stock hay sino **cuántos días dura**: 200 unidades
de algo que sale de a diez por día es poco, y 200 de algo que sale de a una por
semana es plata quieta en un estante. Cada producto queda clasificado en
*agotado*, *se agota pronto*, *normal*, *sobra*, *dormido* o *sin movimiento*.

Los insumos no aparecen acá: no se venden, se consumen armando.

### En el inicio

El panel de inicio abre con la foto de los últimos 30 días —vendido, ganancia
bruta, perdido por roturas y stock valorizado— para no tener que entrar a
buscarla.

## Seguimiento del envío

Los pedidos con envío muestran una casilla de seguimiento cuando están por
salir. Es **opcional** —un cadete no tiene código— y se puede corregir después
sin tocar el estado.

El número entra en el mensaje de WhatsApp que avisa que salió. Si el pedido no
tiene seguimiento cargado, la línea entera desaparece del mensaje.
 El cliente también lo ve en **Mis pedidos**.

---

## Comandos

```bash
npm run dev         # desarrollo
npm run build       # build de producción
npm run typecheck   # chequeo de tipos
npm run lint
npm run types:gen   # regenera src/types/database.ts desde el esquema real

