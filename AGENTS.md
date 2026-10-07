---
name: lauti-guidelines-mk1
description: "Úsalas al escribir, editar, revisar o refactorizar código para seguir el flujo de trabajo general de lauti: exponer suposiciones, señalar ambigüedades, preferir implementaciones simples y acotadas, evitar abstracciones especulativas, realizar cambios quirúrgicos y verificar el trabajo frente a criterios de éxito claros."
---

## 1. Piensa antes de programar

**No asumas nada. No ocultes la confusión. Expón las compensaciones (trade-offs).**

Antes de implementar:
- Expresa explícitamente tus suposiciones. Si tienes dudas, pregunta.
- Si existen varias interpretaciones, preséntalas; no elijas una en silencio.
- Si existe un enfoque más simple, dilo. Cuestiona la propuesta cuando esté justificado.
- Si algo no está claro, detente. Identifica qué es confuso. Pregunta.

## 2. La simplicidad ante todo

**El código mínimo necesario para resolver el problema. Nada de especulaciones.**

- Sin funcionalidades adicionales a las solicitadas.
- Sin abstracciones para código de un solo uso.
- Sin "flexibilidad" o "configurabilidad" no solicitada.
- Sin gestión de errores para escenarios imposibles.
- Si escribes 200 líneas y podrían ser 50, reescríbelo.

Pregúntate: "¿Un ingeniero senior diría que esto es demasiado complejo?". Si la respuesta es sí, simplifícalo.

## 3. Cambios quirúrgicos

**Modifica solo lo estrictamente necesario. Limpia solo el desorden que tú mismo has creado.**

Al editar código existente:
- No "mejores" el código, los comentarios o el formato adyacentes.
- No refactorices elementos que funcionan correctamente.
- Mantén el estilo existente, aunque tú lo harías de otra manera.
- Si detectas código muerto no relacionado, menciónalo, pero no lo elimines.

Cuando tus cambios generen elementos huérfanos:
- Elimina las importaciones, variables o funciones que hayan quedado sin uso debido a TUS cambios.
- No elimines código muerto preexistente a menos que se te solicite.

La prueba: cada línea modificada debe poder vincularse directamente a la solicitud del usuario.

## 4. Ejecución orientada a objetivos

**Define los criterios de éxito.** Itera hasta obtener la verificación.**

Transforma las tareas en objetivos verificables:
- "Añadir validación" → "Escribir pruebas para entradas no válidas y lograr que las superen"
- "Corregir el error" → "Escribir una prueba que lo reproduzca y lograr que la supere"
- "Refactorizar X" → "Asegurarse de que las pruebas se superen antes y después"

Para tareas de varios pasos, establece un plan breve:
```
1. [Paso] → verificar: [comprobación]
2. [Paso] → verificar: [comprobación]
3. [Paso] → verificar: [comprobación]
```

Unos criterios de éxito sólidos permiten trabajar de forma independiente. Los criterios vagos ("hacer que funcione") requieren aclaraciones constantes.

---

## 5. Manejo de Variables
- Las variables deben declararse en camelCase.

## 6. Creación de Componentes y UI
- Cada vez que se genere un nuevo elemento debe verificarse para buscar si ya existe algo similar a lo necesitado.
- No deben hardcodearse estilos dentro del frontend.
- Todos los componentes que se añadan a la hoja de estilos deben ser pensados como
elementos reutilizables.
- Utiliza siempre las variables globales de diseño (Design Tokens) definidas en el proyecto para colores, espaciados y tipografía.
- Mantener consistencia visual en todo el sistema.
- Esta terminantemente prohibido usar emojis del sistema. Toda ilustración debe estar en Assets/new-icons, en caso de no estar, incrustar una ilustración estilo path.

## 7. Nombre de commits

- Al finalizar una tarea, el asistente debe proponer **siempre** uno o más nombres de commit (formato `PREFIJO: descripción breve en español`).
- Prefijos del repositorio, sincronizados con `README.md` ("Flujo de trabajo y convenciones"):

| Prefijo     | Uso                                             |
| ----------- | ----------------------------------------------- |
| `ADDED:`    | Nueva funcionalidad                            |
| `FIX:`      | Corrección de bug                             |
| `HOTFIX:`   | Fix urgente aplicado directo en producción     |
| `REFACTOR:` | Reorganización sin cambio de comportamiento (mover/renombrar/limpiar) |

**Estas pautas funcionan si:** hay menos cambios innecesarios en las diferencias de código (*diffs*), menos reescrituras por exceso de complejidad y las preguntas aclaratorias surgen antes de la implementación en lugar de después de cometer errores.
