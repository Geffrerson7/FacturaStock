import { Form, Button, Input, Label, TextField } from "@heroui/react";



export default function Login(){
    return (
        <Form className="flex flex-col gap-4 mt-6">
            <TextField>
                <Label>Correo</Label>
                <Input placeholder="abc@gmail.com"></Input>
            </TextField>
            <TextField>
                <Label>Contraseña</Label>
                <Input placeholder="Contraseña"></Input>
            </TextField>
            <Button type="submit" className="bg-black w-full">
                Iniciar Sesion
            </Button>
        </Form>
    )
}